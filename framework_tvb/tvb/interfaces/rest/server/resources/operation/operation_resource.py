# -*- coding: utf-8 -*-
#
#
# TheVirtualBrain-Framework Package. This package holds all Data Management, and
# Web-UI helpful to run brain-simulations. To use it, you also need do download
# TheVirtualBrain-Scientific Package (for simulators). See content of the
# documentation-folder for more details. See also http://www.thevirtualbrain.org
#
# (c) 2012-2020, Baycrest Centre for Geriatric Care ("Baycrest") and others
#
# This program is free software: you can redistribute it and/or modify it under the
# terms of the GNU General Public License as published by the Free Software Foundation,
# either version 3 of the License, or (at your option) any later version.
# This program is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
# PARTICULAR PURPOSE.  See the GNU General Public License for more details.
# You should have received a copy of the GNU General Public License along with this
# program.  If not, see <http://www.gnu.org/licenses/>.
#
#
#   CITATION:
# When using The Virtual Brain for scientific publications, please cite it as follows:
#
#   Paula Sanz Leon, Stuart A. Knock, M. Marmaduke Woodman, Lia Domide,
#   Jochen Mersmann, Anthony R. McIntosh, Viktor Jirsa (2013)
#       The Virtual Brain: a simulator of primate brain network dynamics.
#   Frontiers in Neuroinformatics (7:10. doi: 10.3389/fninf.2013.00010)
#
#

import shutil
import os
from tvb.basic.logger.builder import get_logger
from tvb.core.adapters.abcadapter import ABCAdapter
from tvb.core.adapters.abcuploader import ABCUploader
from tvb.core.entities.file.files_helper import FilesHelper
from tvb.core.neotraits.h5 import ViewModelH5
from tvb.core.services.exceptions import ProjectServiceException
from tvb.core.services.flow_service import FlowService
from tvb.core.services.operation_service import OperationService
from tvb.core.services.project_service import ProjectService
from tvb.core.services.user_service import UserService
from tvb.interfaces.rest.commons.dtos import DataTypeDto
from tvb.interfaces.rest.commons.exceptions import InvalidIdentifierException, ServiceException
from tvb.interfaces.rest.commons.status_codes import HTTP_STATUS_CREATED
from tvb.interfaces.rest.server.resources.project.project_resource import INVALID_PROJECT_GID_MESSAGE
from tvb.interfaces.rest.server.resources.rest_resource import RestResource

INVALID_OPERATION_GID_MESSAGE = "No operation found for GID: %s"


class GetOperationStatusResource(RestResource):

    def get(self, operation_gid):
        """
        :return status of an operation
        """
        operation = ProjectService.load_operation_by_gid(operation_gid)
        if operation is None:
            raise InvalidIdentifierException(INVALID_OPERATION_GID_MESSAGE % operation_gid)

        return operation.status


class GetOperationResultsResource(RestResource):

    def get(self, operation_gid):
        """
        :return list of DataType instances (subclasses), representing the results of that operation if it has finished and
        None, if the operation is still running, has failed or simply has no results.
        """
        operation = ProjectService.load_operation_lazy_by_gid(operation_gid)
        if operation is None:
            raise InvalidIdentifierException(INVALID_OPERATION_GID_MESSAGE % operation_gid)

        data_types = ProjectService.get_results_for_operation(operation.id)
        if data_types is None:
            return []

        return [DataTypeDto(datatype) for datatype in data_types]


class LaunchOperationResource(RestResource):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.logger = get_logger(self.__class__.__module__)
        self.operation_service = OperationService()
        self.project_service = ProjectService()
        self.user_service = UserService()
        self.files_helper = FilesHelper()

    def post(self, project_gid, algorithm_module, algorithm_classname):
        """
        :generic method of launching Analyzers
        """
        model_file = self.extract_file_from_request()
        destination_folder = RestResource.get_destination_folder()
        h5_path = RestResource.save_temporary_file(model_file, destination_folder)

        try:
            project = self.project_service.find_project_lazy_by_gid(project_gid)
        except ProjectServiceException:
            raise InvalidIdentifierException(INVALID_PROJECT_GID_MESSAGE % project_gid)

        algorithm = FlowService.get_algorithm_by_module_and_class(algorithm_module, algorithm_classname)
        if algorithm is None:
            raise InvalidIdentifierException('No algorithm found for: %s.%s' % (algorithm_module, algorithm_classname))

        try:
            adapter_instance = ABCAdapter.build_adapter(algorithm)
            view_model = adapter_instance.get_view_model_class()()

            view_model_h5 = ViewModelH5(h5_path, view_model)
            view_model_gid = view_model_h5.gid.load()

            # TODO: use logged user
            user_id = project.fk_admin
            operation = self.operation_service.prepare_operation(user_id, project.id, algorithm.id,
                                                                 algorithm.algorithm_category, view_model_gid.hex, None,
                                                                 {})
            storage_path = self.files_helper.get_project_folder(project, str(operation.id))

            if isinstance(adapter_instance, ABCUploader):

                index = 1
                for key, value in adapter_instance.get_upload_information().items():
                    data_file = self.extract_file_from_request(file_name='data_file_' + str(index), file_extension=value)
                    data_file_path = RestResource.save_temporary_file(data_file, destination_folder)
                    file_name = os.path.basename(data_file_path)
                    upload_field = getattr(view_model_h5, key)
                    upload_field.store(os.path.join(storage_path, file_name))
                    shutil.move(data_file_path, storage_path)
                    index = index + 1

            shutil.move(h5_path, storage_path)
            os.rmdir(destination_folder)
            view_model_h5.close()
            OperationService().launch_operation(operation.id, True)
        except Exception as excep:
            self.logger.error(excep, exc_info=True)
            raise ServiceException(str(excep))

        return operation.gid, HTTP_STATUS_CREATED
