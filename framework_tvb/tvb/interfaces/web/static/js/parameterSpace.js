/**
 * TheVirtualBrain-Framework Package. This package holds all Data Management, and
 * Web-UI helpful to run brain-simulations. To use it, you also need do download
 * TheVirtualBrain-Scientific Package (for simulators). See content of the
 * documentation-folder for more details. See also http://www.thevirtualbrain.org
 *
 * (c) 2012-2013, Baycrest Centre for Geriatric Care ("Baycrest")
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License version 2 as published by the Free
 * Software Foundation. This program is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
 * License for more details. You should have received a copy of the GNU General
 * Public License along with this program; if not, you can download it here
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0
 *
 **/
/* global doAjaxCall, displayMessage */
//general chores
//todo create an exporting function that can save the figure
//todo create a red marker line that pinpoints the dot on the canvas (or just highlights the grid lines)
//todo create a function that will normalize the size attributes that belong to the results

// We keep all-nodes information for current PSE as a global, to have them ready at node-selection, node-overlay.
var PSE_nodesInfo;
// Keep Plot-options and MIN/MAx colors for redraw (e.g. at resize).
var _PSE_plotOptions;
var _PSE_minColor;
var _PSE_maxColor;
var _PSE_plot;

/*
 * @param canvasId: the id of the HTML DIV on which the drawing is done. This should have sizes defined or else FLOT can't do the drawing.
 * @param xLabels: the labels for the x - axis
 * @param yLabels: the labels for the y - axis
 * @param seriesArray: the actual data to be used by FLOT
 * @param data_info: additional information about each node. Used when hovering over a node
 * @param min_color: minimum color, used for gradient
 * @param max_color: maximum color, used for gradient
 * @param backPage: page where visualizers fired from overlay should take you back.
 */
function _updatePlotPSE(canvasId, xLabels, yLabels, seriesArray, data_info, min_color, max_color, backPage) {

    // why is it that we don't associate the labels into the attributes of the actual data_info or seriesArray?
    // where does the seriesArray structure get created?
    _PSE_minColor = min_color;
    _PSE_maxColor = max_color;
    PSE_nodesInfo = data_info;
    _PSE_plotOptions = {
        series: {
            lines: {
                show: false
            },
            points: {
                lineWidth: 0,
                show: true,
                fill: true
            }
        },
        margins: { // is this the correct way to be doing margins? It's just how I have in the past,
            top: 20,
            bottom: 40,
            left: 20,
            right: 50
        },
        xaxis: {
            labels: xLabels, // is there a better way to get access to these values inside my plotting?
            min: -1,
            max: xLabels.length,
            tickSize: 1,
            tickFormatter: function (val) {
                if (val < 0 || val >= xLabels.length) {
                    return "";
                }
                return xLabels[val];
            }
        },
        yaxis: {
            labels: yLabels,
            min: -1,
            max: yLabels.length,
            tickSize: 1,
            tickFormatter: function (val) {
                if (val < 0 || val >= yLabels.length || yLabels[val] === "_") {
                    return "";
                }
                return yLabels[val];
            }
        },
        grid: {
            clickable: true,
            hoverable: true
        }

    };
    _d3PSE_plot = d3Plot("#" + canvasId, seriesArray, $.extend(true, {}, _PSE_plotOptions), backPage);

    //this has been commented out below so that I can see what I have done on the canvas after the above function has ended
    /*_PSE_plot = $.plot($("#" + canvasId), $.parseJSON(seriesArray), $.extend(true, {}, _PSE_plotOptions));
     changeColors(); // this will need to eventually have the addition of the d3 plot function
     $(".tickLabel").each(function () {
     $(this).css("color", "#000000");
     });
     //if you want to catch the right mouse click you have to change the flot sources
     // because it allows you to catch only "plotclick" and "plothover"
     applyClickEvent(canvasId, backPage);
     applyHoverEvent(canvasId);*/
}


function d3Plot(placeHolder, data, options, pageParam) {
    //these lines are cleanup for artifacts of the conversion that aren't behaving nicely, they should eventually be removed because they are just treating the symptoms.
    if (d3.select(".outerCanvas").empty() != true) {
        d3.selectAll(".outerCanvas").remove()
    }
    if (d3.selectAll("#main_div_pse")[0].length != 1) {
        var oneOrMoreDiv = d3.selectAll("div > div.flex-wrapper"); //index necessary because selection is an array with two elements, and second is unneccessary

        if (oneOrMoreDiv[0].length > 1) {
            oneOrMoreDiv[0][1].remove()
        } else {
            oneOrMoreDiv[0][0].remove()
        }
    }
    function createScale(xORy, labelArr) {
        // !! there is the potential to create wrong looking figures when the lower extent has a negative value in it, but is this just an error coming from large ranges? or
        //todo change this to allow for values above the initial data range
        if (xORy === "x") {
            var [lowerExtent,upperExtent] = d3.extent(labelArr),
                extentPadding = ((upperExtent - lowerExtent) * .10) / 2, // this multiplication factor controls how much the dots are gathered together
                [padLo,padUp] = [lowerExtent - extentPadding, upperExtent + extentPadding];


                var newScale = d3.scale.linear()
                    .domain([padLo, padUp])
                    .range([options.margins.left, innerWidth - options.margins.right]);
            }
        else {
            var [lowerExtent,upperExtent] = d3.extent(labelArr),
                extentPadding = ((upperExtent - lowerExtent) * .35) / 2,
                [padLo,padUp] = [lowerExtent - extentPadding, upperExtent + extentPadding];


                var newScale = d3.scale.linear()
                    .domain([padLo, padUp])
                    .range([innerHeight - (options.margins.bottom), options.margins.top]);

            }
            return newScale
        }


    function createRange(arr) { // this makes a large range in the form of an array of values that configure to the proper step value that the ticks would otherwise be spaced at.
        //todo tie this to the step object that is now in existen
        var step = arr[1] - arr[0];
        return d3.range(-50 + arr[1], 50 + arr[1], step)
    }

    function createAxis(xORy) {
        if (xORy === "x") { // should I be creating the whole axis inside here, or should I simply return the axis that has the parts to be customized and called later
            newAxis = d3.svg.axis().scale(xScale)
                .orient("bottom")
                .tickValues(createRange(_PSE_plotOptions.xaxis.labels))
                .tickFormat(d3.format(",.2f"));
            return newAxis
        }
        else {
            newAxis = d3.svg.axis().scale(yScale)
                .orient("left")
                .tickValues(createRange(_PSE_plotOptions.yaxis.labels))
                .tickFormat(d3.format(",.2f")); // this means add in , when thousands are used, and look for 2 digits past the decimal, with value considered float type
            return newAxis
        }
    }

    function split_element_string(string) {
        string = string.replace("\n")
    }

    function getFilterSelections() {
        doAjaxCall({
            type: 'POST',
            url: '/flow/get_pse_filters/' + datatypeGID,
            success: function (r) {
                for (var i = 0; i < d3.selectAll(".action-store")[0].length; i++) { // note the indexing due to the selectAll returning a one ele array of multiple arrays
                    var selectElement = d3.select("#filterSelect" + i);
                    selectElement.selectAll("option").remove();
                    selectElement.html(r);// this is the best way that i could come up with to separate out the returned elements
                }

            },
            error: function () {
                displayMessage("couldn't load the selection bar", "errorMessage")
            }
        })
    }
    function moveDots() {
        circles
            .transition()
            .attr({
                r: function (d) {
                    var factor = xzoom.scale() * yzoom.scale()
                    if (factor > 2.5) {
                        return d.points.radius * 2.5;
                    } else if (factor < .5) {
                        return d.points.radius * .5
                    } else {
                        return d.points.radius * factor
                    }


                },
                cx: function (d) {
                    return xScale(d.coords.x)
                },
                cy: function (d) {
                    return yScale(d.coords.y)
                }

                // return yScale(d.yCen) // why is this placing dots far below the bottom of the pane? Is the canvas dimension off?


            })
    }

    function workingDataRemove(index, dataObj) {
        for (i in dataObj) {
            if (dataObj[i].data[0] == index) {
                dataObj.splice(i, 1);
                return
            }
        }

    }

    function refreshOnChange() { //this function exists because if new select bars are added after loading then there is no _onchange handler attributed

        d3.selectAll(".filterSelectBar").on("change", function () { // why wont this execute on all selection bars?

            var filterSpecs = d3.select(this).property("value").split(','),
                filterType = filterSpecs[1].slice(0, -1), // error was coming up due to the extra number tagged onto the end of the button id, this keeps just the part that matters,could break if more than 10 filters rows are created
                incrementId = d3.select(this).property("id").slice(-1); //threshold value (type float) is stored first index, and then the type (string)
            d3.select("input#threshold" + incrementId).property("value", parseFloat(filterSpecs[0]));
            d3.select("input[type='radio']#" + filterType + incrementId).property("checked", true)
        });

        d3.selectAll(".action-store").on("click", function () { // this is the functionality for the save button next to the text box for the select  element.
            var incrementId = d3.select(this).property("id").slice(-1),
                usrSelectedName = d3.select('#overlayNameInput' + incrementId).property('value'),
                incoming_values = {
                    threshold_value: d3.select('input#threshold' + incrementId).property('value'),
                    threshold_type: d3.select('input[name="threshold' + incrementId + '"]:checked').property('id')
                };
            doAjaxCall({
                type: 'POST',
                url: '/flow/store_pse_filter/' + usrSelectedName + '/' + datatypeGID,
                data: incoming_values,
                success: function (r) {
                    getFilterSelections();
                    d3.select('#overlayNameInput' + incrementId).property('value', '')
                },
                error: function () {
                    displayMessage('could not store the selected text', 'errorMessage')
                }

            })
        });

        d3.selectAll(".action-minus").on("click", function () {
            d3.select(this).node().parentNode.remove()
        })
    }


    function getKey(d) {
        return d.key
    }

    function transparentDots() {
        d3.selectAll("circle").data(workingData, getKey).exit()
            .transition()
            .duration(500)
            .attr("fill-opacity", ".1")
    }

    function xyzoomed() { // currently non-functional todo decide whether to remove or fix up
        d3.select("#xAxis").call(xAxis);
        d3.select("#yAxis").call(yAxis);
        d3.select("#xGrid").call(xGrid);
        d3.select("#yGrid").call(yGrid);
        moveDots()
    }

    function xzoomed() {
        d3.select("#xAxis").call(xAxis);
        d3.select("#xGrid").call(xGrid);
        moveDots()
    }

    function yzoomed() {
        d3.select("#yAxis").call(yAxis);
        d3.select("#yGrid").call(yGrid);
        moveDots()
    }

    function returnfill(weight) {

            var colTest = ColSch_getGradientColorString(weight, _PSE_minColor, _PSE_maxColor).replace("a", ""), // the a creates an error in the color scale creation
                d3color = d3.rgb(colTest);
            return d3color

    }


    var myBase, workingData, canvasDimensions, canvas, xScale, yScale, xRef, yRef, xAxis, yAxis, circles, brush,
        dotsCanvas, innerHeight, innerWidth, toolTipDiv, zoom, zoomable, datatypeGID, data24, structure, inclusiveX, inclusiveY, steps;
    myBase = d3.select(placeHolder);
    //the data24 is to simulate the results returned from the exploration tool.
    data24 = [{
        "data": [[0, 0]],
        "points": {"radius": 19.1853172894},
        "coords": {"x": 0.93, "y": 12.33}
    }, {"data": [[0, 1]], "points": {"radius": 22.9928375553}, "coords": {"x": 0.93, "y": 12.83}}, {
        "data": [[0, 2]],
        "points": {"radius": 12.7519426598},
        "coords": {"x": 0.93, "y": 13.33}
    }, {"data": [[0, 3]], "points": {"radius": 18.1498754318}, "coords": {"x": 0.93, "y": 13.83}}, {
        "data": [[0, 4]],
        "points": {"radius": 12.2224671709},
        "coords": {"x": 0.93, "y": 14.33}
    }, {"data": [[0, 5]], "points": {"radius": 16.7006562512}, "coords": {"x": 0.93, "y": 14.83}}, {
        "data": [[1, 0]],
        "points": {"radius": 26.095335614},
        "coords": {"x": 0.98, "y": 12.33}
    }, {"data": [[1, 1]], "points": {"radius": 21.718820915}, "coords": {"x": 0.98, "y": 12.83}}, {
        "data": [[1, 2]],
        "points": {"radius": 26.5846321192},
        "coords": {"x": 0.98, "y": 13.33}
    }, {"data": [[1, 3]], "points": {"radius": 15.6576946551}, "coords": {"x": 0.98, "y": 13.83}}, {
        "data": [[1, 4]],
        "points": {"radius": 16.0924128895},
        "coords": {"x": 0.98, "y": 14.33}
    }, {"data": [[1, 5]], "points": {"radius": 10}, "coords": {"x": 0.98, "y": 14.83}}, {
        "data": [[2, 0]],
        "points": {"radius": 12.862484061},
        "coords": {"x": 1.03, "y": 12.33}
    }, {"data": [[2, 1]], "points": {"radius": 23.2339264002}, "coords": {"x": 1.03, "y": 12.83}}, {
        "data": [[2, 2]],
        "points": {"radius": 31.8010742281},
        "coords": {"x": 1.03, "y": 13.33}
    }, {"data": [[2, 3]], "points": {"radius": 30.8209462332}, "coords": {"x": 1.03, "y": 13.83}}, {
        "data": [[2, 4]],
        "points": {"radius": 27.0538952451},
        "coords": {"x": 1.03, "y": 14.33}
    }, {"data": [[2, 5]], "points": {"radius": 18.3147344831}, "coords": {"x": 1.03, "y": 14.83}}, {
        "data": [[3, 0]],
        "points": {"radius": 19.1483833282},
        "coords": {"x": 1.08, "y": 12.33}
    }, {"data": [[3, 1]], "points": {"radius": 25.2752743433}, "coords": {"x": 1.08, "y": 12.83}}, {
        "data": [[3, 2]],
        "points": {"radius": 20.4643681626},
        "coords": {"x": 1.08, "y": 13.33}
    }, {"data": [[3, 3]], "points": {"radius": 23.1271435287}, "coords": {"x": 1.08, "y": 13.83}}, {
        "data": [[3, 4]],
        "points": {"radius": 33},
        "coords": {"x": 1.08, "y": 14.33}
    }, {"data": [[3, 5]], "points": {"radius": 32.3596795}, "coords": {"x": 1.08, "y": 14.83}}]
    workingData = $.parseJSON(data);

    [inclusiveX, inclusiveY] = updateCoordinateArrays(constructLabels(workingData), constructLabels(data24));
    steps = {x: [], y: []};
    updateKnownSteps(steps, inclusiveX, inclusiveY); // must determine a way to have every step value, not just the smallest.
    steps.y = [1, .5];// presence of the 1 this is just an attempt to test a bug resolution in the bottom
    //todo take this line out when not interested in normalized data24 radii
    for (var ob of data24) {
        ob.points.radius = ob.points.radius / 4;
    }
    workingData = mergeResults(workingData, data24)
    structure = createStructure(workingData, inclusiveX, inclusiveY);
    for (ind in workingData) { //todo determine whether the new coords attribute will provide a way for us to be able to target the results in the way this does for adjustment in filtering or removal.
        workingData[ind].key = parseFloat(ind)
    }
    ;
    canvasDimensions = {h: parseInt(myBase.style("height")), w: parseInt(myBase.style("width"))};
    innerHeight = canvasDimensions.h - options.margins.top;
    innerWidth = canvasDimensions.w - options.margins.left;
    datatypeGID = d3.select("#datatype-group-gid").property("value");
    xScale = createScale("x", inclusiveX);
    yScale = createScale("y", inclusiveY);
    xyzoom = d3.behavior.zoom()
        .x(xScale)
        .y(yScale)
        .on("zoom", xyzoomed);
    yzoom = d3.behavior.zoom()
        .y(yScale)
        .on("zoom", yzoomed);
    xzoom = d3.behavior.zoom()
        .x(xScale)
        .on("zoom", xzoomed);
    canvas = myBase.append("svg")
        .attr({
            class: "outerCanvas",
            height: canvasDimensions.h,
            width: canvasDimensions.w
        })
        .append("g")
        .attr("transform", "translate( " + options.margins.left + "," + options.margins.top + " )");
    canvasClip = canvas.append("svg:clipPath")
        .attr("id", "genClip")
        .append("svg:rect")
        .attr("id", "clipRect")
        .attr("x", _PSE_plotOptions.margins.left)
        .attr("y", _PSE_plotOptions.margins.top)
        .attr("width", innerWidth - _PSE_plotOptions.margins.left - _PSE_plotOptions.margins.right)
        .attr("height", innerHeight - _PSE_plotOptions.margins.bottom - _PSE_plotOptions.margins.top);
    xAxisClip = canvas.append("svg:clipPath")
        .attr("id", "xClip")
        .append("svg:rect")
        .attr("x", _PSE_plotOptions.margins.left)
        .attr("y", 0)
        .attr("width", innerWidth - _PSE_plotOptions.margins.left - _PSE_plotOptions.margins.right)
        .attr("height", _PSE_plotOptions.margins.bottom);
    yAxisClip = canvas.append("svg:clipPath")
        .attr("id", "yClip")
        .append("svg:rect")
        .attr("x", -_PSE_plotOptions.margins.left * 2)// these two areas are simply selected for what they accomplish visually. I wonder if there could be a real connection to the values used for arranging the canvas
        .attr("y", _PSE_plotOptions.margins.top)
        .attr("width", _PSE_plotOptions.margins.right)//
        .attr("height", innerHeight - _PSE_plotOptions.margins.bottom - _PSE_plotOptions.margins.top);

    toolTipDiv = d3.select(".tooltip");
    xAxis = createAxis("x");
    xGrid = createAxis("x")
        .tickSize(innerHeight, 0, 0)
        .tickFormat("");
    yAxis = createAxis("y");
    yGrid = createAxis("y")
        .tickSize(-innerWidth, 0, 0)
        .tickFormat("");


    canvas.append("g")
        .attr("id", "yGrid")
        .attr("clip-path", "url(#genClip)")
        .attr("transform", "translate (0,0)")
        .style("stroke", "gray")
        .style("stroke-opacity", ".5")
        .call(yGrid);

    canvas.append("g")
        .attr("id", "xGrid")
        .attr("clip-path", "url(#genClip)")
        .attr("transform", "translate (0,0)")
        .style("stroke", "gray")
        .style("stroke-opacity", ".5")
        .call(xGrid);

    canvas.append("g") // the tricky part here is to applythe clip where the xaxis was before the transform
        .attr("id", "xAxis")
        .attr("clip-path", "url(#xClip)")
        .attr("transform", "translate (0," + ( innerHeight - _PSE_plotOptions.margins.bottom ) + ")")
        .call(xAxis)
        .call(xzoom);
    canvas.append("g")
        .attr("id", "yAxis")
        .attr("clip-path", "url(#yClip)")
        .attr("transform", "translate (" + _PSE_plotOptions.margins.left + " ,0)")
        .call(yAxis)
        .call(yzoom);

    dotsCanvas = canvas.append("svg")
        .classed("dotsCanvas", true)
        .attr({
            height: innerHeight,
            width: innerWidth
        })
        .attr("clip-path", "url(#genClip)");
    circles = dotsCanvas.selectAll("circle").data(workingData, getKey).enter().append("circle")
        .attr({
            r: function (d) {
                return d.points.radius
            },
            cx: function (d) {
                return xScale(d.coords.x) //use the newly attributed coordinate attribute from the data
            },
            cy: function (d) {
                return yScale(d.coords.y)
            },
            // fill: function (d) {
            //     var nodeInfo = PSE_nodesInfo[d.data[0][0]][d.data[0][1]]; // the data attribute still has usefulness in retrieving the nodeInformation, but perhaps later it can be worked out.
            //     if (nodeInfo.tooltip.search("PENDING") == -1 && nodeInfo.tooltip.search("CANCELED") == -1) {
            //         color = returnfill(nodeInfo.color_weight);
            //     }
            //     else {
            //         var color = d3.rgb("black");
            //     }
            //     return color
            // }

        });

    d3.select("#Contour").on("click", function () {

        function drawCompLines(relationOb) {

            var lineFunc = d3.svg.line()
                .x(function (d) {
                    return d.x
                })
                .y(function (d) {
                    return d.y
                })
                .interpolate("linear");

            for (var currentOb of relationOb) {
                for (var neighbor of currentOb.neighbors) {
                    var neighborsCoords = neighbor.split(" ").map(function (ele) {
                            return +ele
                        }), //breakdown of line: separate and convert coordinates from string to float before assigning to variables.
                        xNeighbor = xScale(neighborsCoords[0]),
                        yNeighbor = yScale(neighborsCoords[1]),
                        obX = xScale(currentOb.focalPoint.coords.x),
                        obY = yScale(currentOb.focalPoint.coords.y),
                        deltaX = (xNeighbor - obX), //simple final minus initial for change
                        deltaY = (yNeighbor - obY),
                        midPoint = {x: obX + deltaX / 2, y: obY + deltaY / 2},
                        startCoord = {x: midPoint.x + deltaY / 2, y: midPoint.y - deltaX / 2},
                        endCoord = {x: midPoint.x - deltaY / 2, y: midPoint.y + deltaX / 2};
                    d3.select(".dotsCanvas").append("path")
                        .attr("d", lineFunc([startCoord, endCoord]))
                        .attr("stroke", "red")
                        .attr("stroke-width", ".5px")
                        .attr("fill-opacity", ".1")
                        .attr("fill", "none");
                }
            }

        }

        neighborsObjct = compareToNeighbors(structure, steps, inclusiveX, inclusiveY)
        drawCompLines(neighborsObjct)
    })

    
    d3.select("#Explore").on("click", function () {
        function expBrushMove() {
            // var xRange
        }

        function expBrushStop() { // todo add sliders to the div that shows up
            if (exploreBrush.empty() == true) {
                explToolTip.style("display", "none")
            } else {
                var extent = exploreBrush.extent();
                var xRange = Math.abs(extent[0][0] - extent[1][0]),
                    yRange = Math.abs(extent[0][1] - extent[1][1]);
                explToolTip.style({
                    position: "absolute",
                    left: xScale(extent[1][0]) + _PSE_plotOptions.margins.left + "px", //this is the x cordinate of where the drag ended (assumption here is drags from left to right
                    top: yScale(extent[1][1]) + _PSE_plotOptions.margins.top + 100 + "px",
                    display: "block",
                    'background-color': '#C0C0C0',
                    border: '1px solid #fdd',
                    padding: '2px',
                    opacity: 0.80
                });
                d3.select("#xRange").text(xRange);
                d3.select("#yRange").text(yRange)
            }
        }

        var explToolTip = d3.select("#ExploreToolTip");

        var exploreBrush = d3.svg.brush()
            .x(xScale)
            .y(yScale)
            .on("brush", expBrushMove)
            .on("brushend", expBrushStop);
        if (d3.select(".brush").empty() == true) {
            canvas.append("g")
                .attr("class", "brush")
                .call(exploreBrush)
                .selectAll("rect");
        } else {
            d3.select(".brush").remove();
            explToolTip.style("display", "none"); // is this redundant with the above tooltip hider?
        }


    });

    d3.select("#Filter").on("click", function () { //todo standardize the id names for the div elements used for the various overlays.


        var filterDiv = d3.select("#FilterDiv"),
            idNum = d3.selectAll("#threshold").length;
        if (filterDiv.style("display") == "none") {
            filterDiv.style("display", "block");
            getFilterSelections()
            refreshOnChange()
        }


        else {
            filterDiv.style("display", "none")
        }
    });

    d3.select("#filterGo").on("click", function () {
        // so I could make a function that gets called on each of the bars that have been selected yes?
        function thresholdFilterSize(cir, set) {
            var radius = parseFloat(cir.attributes.r.value);
            if (radius < sizeScale(criteria.threshold.value)) {
                set.add(cir.__data__.data[0]); // why does having workingData as an argument make it in the local scope all of a sudden?
            }
        }

        function thresholdFilterColor(cir, set) { //todo !!ask about how to easily give users a way to select a reasonable value, because numbers are really small
            // will I need to be able to parse exponential(scientific) digits?
            // should I give people a sampling tool for the color? like an eyedropper?
            var nodeInfo = PSE_nodesInfo[cir.__data__.data[0][0]][cir.__data__.data[0][1]];
            if (nodeInfo.color_weight < criteria.threshold.value) {
                set.add(cir.__data__.data[0]);
            }
        }


        var allCircles = d3.selectAll("circle"),
            min_size = d3.select("#minShapeLabel").node().innerHTML,
            max_size = d3.select("#maxShapeLabel").node().innerHTML,
            sizeScale = d3.scale.linear()
                .domain([+min_size, +max_size]) // these plus signs convert the string to number
                .range(d3.extent(workingData, function (d) {
                    return +d.points.radius
                })), // makes sure that we don't start creating negative radii based on user input, clamps to upper or lower bounds
            criteria = {
                threshold: {//currently this is hard coded for the size filters which needs to be updated
                    value: +d3.select("#threshold").node().value //todo eventually update this to reflect the changes made to the way that the input bars are enumerated
                    , type: d3.select("input[name=threshold]:checked").node().id
                },//specifies color versus size measurements
                rate: { // how to relate rate of change  to the max and min
                    value: +d3.select("#rateOfChange").node().value //in theory this won't need to have the scale, because the differences will be arbitrary value
                    , type: d3.select("input[name=rateOfChange]:checked").node().id
                },
                logic: d3.select("input[name=logicButton]:checked").node().id
            },
            removalSet,
            radDiffColScale = d3.scale.linear()
                .domain([0, max_size - min_size])
                .range(["white", "red"]);

        if (criteria.logic == "Or") {
            var thresholdSet = new Set(),
                rateSet = new Set();
            d3.selectAll("circle")[0].forEach(function (d) {// [0] part seems strange, is there another way to use forEach without it?
                if (criteria.threshold.type == "Size" && criteria.rate.type == "Size") {
                    thresholdFilterSize(d, thresholdSet);
                    rateFilterSize(d, rateSet);

                } else if (criteria.threshold.type == "Color" && criteria.rate.type == "Size") {
                    thresholdFilterColor(d, thresholdSet);
                    rateFilterSize(d, rateSet);

                } else if (criteria.threshold.type == "Size" && criteria.rate.type == "Color") {
                    thresholdFilterSize(d, thresholdSet);
                    rateFilterColor(d, rateSet);
                } else {
                    thresholdFilterColor(d, thresholdSet);
                    rateFilterColor(d, rateSet)
                }
            });
            // @formatter:off
            removalSet = new Set([...thresholdSet, ...rateSet]);// this performs a union of the two sets, and the actual syntax is messing up pycharm
            // @formatter: on
        } else if (criteria.logic == "And") {
            var thresholdSet = new Set(),
                rateSet = new Set();
            d3.selectAll("circle")[0].forEach(function (d) {// [0] part seems strange, is there another way to use forEach without it?
                if (criteria.threshold.type == "Size" && criteria.rate.type == "Size") {
                    thresholdFilterSize(d, thresholdSet);
                    rateFilterSize(d, rateSet);

                } else if (criteria.threshold.type == "Color" && criteria.rate.type == "Size") {
                    thresholdFilterColor(d, thresholdSet);
                    rateFilterSize(d, rateSet);

                } else if (criteria.threshold.type == "Size" && criteria.rate.type == "Color") {
                    thresholdFilterSize(d, thresholdSet);
                    rateFilterColor(d, rateSet);
                } else {
                    thresholdFilterColor(d, thresholdSet);
                    rateFilterColor(d, rateSet)
                }

            });

            //line below is pycharm commmand to prevent bug triggered by auto format
            // @formatter:off
            removalSet = new Set([...thresholdSet].filter(x => rateSet.has(x))) // this is an intersection for set arithmetic the [...] converts by spreading out elements => is a shorthand function form
            // @formatter:on


        }
        ;
        ;
        removalSet.forEach(function (indPair) {
            workingDataRemove(indPair, workingData)
        });
        transparentDots()
    });



    d3.selectAll("circle").on("mouseover", function (d) {
        var nodeInfo = PSE_nodesInfo[d.data[0][0]][d.data[0][1]];
        var toolTipText = nodeInfo.tooltip.split("&amp;").join("&").split("&lt;").join("<").split("&gt;").join(">");
        toolTipDiv.html(toolTipText);
        toolTipDiv.style({
            position: "absolute",
            left: (d3.event.pageX) + "px",
            top: (d3.event.pageY - 100) + "px",
            display: "block",
            'background-color': '#C0C0C0',
            border: '1px solid #fdd',
            padding: '2px',
            opacity: 0.80
        })
    })
        .on("mouseout", function (d) {
            toolTipDiv.transition()
                .duration(300)
                .style("display", "none")
        });
    d3.selectAll("circle").on("click", function (d) {
        var nodeInfo = PSE_nodesInfo[d.data[0][0]][d.data[0][1]];
        if (nodeInfo.dataType != undefined) {
            displayNodeDetails(nodeInfo['Gid'], nodeInfo['dataType'], pageParam); // curious because backPage isn't in the scope, but appears to work.
        }
    });


    d3.select("#addFilterOps").on("click", function () {
        var nextRowId = d3.selectAll("button.action-store")[0].length;
        doAjaxCall({
            type: "POST",
            url: "/flow/create_row_of_specs/" + nextRowId + "/", //remember if you experience an error about there now being a row for one(), there is some silly typo sitting around, so go and check everything with the working examples.
            success: function (r) {
                var newLiEntry = d3.select("#FilterDiv > ul").append("li").html(r)
                getFilterSelections()
                refreshOnChange()
            },
            error: function () {
                displayMessage("couldn't add new row of filter options", "errorMessage")
            }
        })

    })


}
/*
 * Do a redraw of the plot. Be sure to keep the resizable margin elements as the plot method seems to destroy them.
 */
function redrawPlot(plotCanvasId) {
    /*// todo: mh the selected element is not an ancestor of the second tab!!!
     // thus this redraw call fails, ex on resize

     if (_PSE_plot != null) {
     _PSE_plot = $.plot($('#' + plotCanvasId)[0], _PSE_plot.getData(), $.extend(true, {}, _PSE_plotOptions));
     }*/
    //it appears that there is a tie in for window.resize to this function. Lets see how this works out
    if (backPage == null || backPage == '') {
        var backPage = get_URL_param('back_page');
    }
    PSE_mainDraw('main_div_pse', backPage)

}


/*
 * Fire DataType overlay when clicking on a node in PSE.
 */
function applyClickEvent(canvasId, backPage) {
    var currentCanvas = $("#" + canvasId);
    currentCanvas.unbind("plotclick");
    currentCanvas.bind("plotclick", function (event, pos, item) {
        if (item != null) {
            var dataPoint = item.datapoint;
            var dataInfo = PSE_nodesInfo[dataPoint[0]][dataPoint[1]];
            if (dataInfo['dataType'] != undefined) {
                displayNodeDetails(dataInfo['Gid'], dataInfo['dataType'], backPage);
            }
        }
    });
}

var previousPoint = null;
/*
 * On hover display few additional information about this node.
 */
function applyHoverEvent(canvasId) {
    $("#" + canvasId).bind("plothover", function (event, pos, item) {
        if (item) {
            if (previousPoint != item.dataIndex) {
                previousPoint = item.dataIndex;
                $("#tooltip").remove();
                var dataPoint = item.datapoint;
                var dataInfo = PSE_nodesInfo[dataPoint[0]][dataPoint[1]];
                var tooltipText = ("" + dataInfo["tooltip"]).split("&amp;").join("&").split("&lt;").join("<").split("&gt;").join(">");

                $('<div id="tooltip"> </div>').html(tooltipText
                ).css({
                        position: 'absolute', display: 'none', top: item.pageY + 5, left: item.pageX + 5,
                        border: '1px solid #fdd', padding: '2px', 'background-color': '#C0C0C0', opacity: 0.80
                    }
                ).appendTo('body').fadeIn(200);
            }
        } else {
            $("#tooltip").remove();
            previousPoint = null;
        }
    });
}


function PSEDiscreteInitialize(labelsXJson, labelsYJson, series_array, dataJson, backPage, hasStartedOperations,
                               min_color, max_color, min_size, max_size) {


    var labels_x = $.parseJSON(labelsXJson);
    var labels_y = $.parseJSON(labelsYJson);
    var data = $.parseJSON(dataJson);

    min_color = parseFloat(min_color); // todo run a batch of simulations part of the way,  and then cancel to see what the result looks like.
    max_color = parseFloat(max_color);
    min_size = parseFloat(min_size);
    max_size = parseFloat(max_size);

    ColSch_initColorSchemeGUI(min_color, max_color, function () { //this now doesn't create error in simulator panel, why?
        _updatePlotPSE('main_div_pse', labels_x, labels_y, series_array, data, min_color, max_color, backPage);
    });

    function _fmt_lbl(sel, v) {
        $(sel).html(Number.isNaN(v) ? 'not available' : toSignificantDigits(v, 3));
    }

    _fmt_lbl('#minColorLabel', min_color);
    _fmt_lbl('#maxColorLabel', max_color);
    _fmt_lbl('#minShapeLabel', min_size);
    _fmt_lbl('#maxShapeLabel', max_size);

    if (Number.isNaN(min_color)) {
        min_color = 0;
        max_color = 1;
    }
    _updatePlotPSE('main_div_pse', labels_x, labels_y, series_array, data, min_color, max_color, backPage); 


    if (hasStartedOperations) {
        setTimeout("PSE_mainDraw('main_div_pse','" + backPage + "')", 3000);
    }
}


/*
 * Take currently selected metrics and refresh the plot.
 */
function PSE_mainDraw(parametersCanvasId, backPage, groupGID) {

    if (groupGID == null) {
        // We didn't get parameter, so try to get group id from page
        groupGID = document.getElementById("datatype-group-gid").value;
    }
    if (backPage == null || backPage == '') {
        backPage = get_URL_param('back_page');
    }

    var url = '/burst/explore/draw_discrete_exploration/' + groupGID + '/' + backPage;
    var selectedColorMetric = $('#color_metric_select').val();
    var selectedSizeMetric = $('#size_metric_select').val();

    if (selectedColorMetric != '' && selectedColorMetric != null) {
        url += '/' + selectedColorMetric;
        if (selectedSizeMetric != '' && selectedSizeMetric != null) {
            url += '/' + selectedSizeMetric;
        }
    }


    doAjaxCall({
        type: "POST",
        url: url,
        success: function (r) {
            $('#' + parametersCanvasId).html(r);
        },
        error: function () {
            displayMessage("Could not refresh with the new metrics.", "errorMessage");
        }
    });
}


/**
 * Changes the series colors according to the color picker component.
 */
function changeColors() {
    var series = _PSE_plot.getData();
    for (var i = 0; i < series.length; i++) {
        var indexes = series[i].datapoints.points;
        var dataInfo = PSE_nodesInfo[indexes[0]][indexes[1]];
        var colorWeight = dataInfo['color_weight'];
        var color = ColSch_getGradientColorString(colorWeight, _PSE_minColor, _PSE_maxColor);
        series[i].points.fillColor = color;
        series[i].color = color;
    }
    _PSE_plot.draw();
}


/*************************************************************************************************************************
 *            ISOCLINE PSE BELLOW
 *************************************************************************************************************************/


var serverURL = null;
var figuresDict = null;
var currentFigure = null;


/*
 * Do the actual resize on currentFigure global var, and a given width and height.
 */
function resizePlot(width, height) {
    if (currentFigure != null) {
        MPLH5_resize = currentFigure;
        do_resize(currentFigure, width, height);
        MPLH5_resize = -1;
    }
}

/*
 * Store all needed data as js variables so we can use later on.
 */
function initISOData(metric, figDict, servURL) {
    figuresDict = $.parseJSON(figDict);
    serverURL = servURL;
    currentFigure = figuresDict[metric];
    connect_manager(serverURL, figuresDict[metric]);
    $('#' + metric).show();
    initMPLH5CanvasForExportAsImage(figuresDict[metric]);
}

/*
 * On plot change update metric and do any required changes like resize on new selected plot.
 */
function updateMetric(selectComponent) {
    var newMetric = $(selectComponent).find(':selected').val();
    showMetric(newMetric);
    var pseElem = $('#section-pse');
    var width = pseElem.width() - 60;
    var height = pseElem.height() - 90;
    waitOnConnection(currentFigure, 'resizePlot(' + width + ', ' + height + ')', 200, 50);
}

/*
 * Update html to show the new metric. Also connect to backend mplh5 for this new image.
 */
function showMetric(newMetric) {
    for (var key in figuresDict) {
        $('#' + key).hide()
            .find('canvas').each(function () {
            if (this.drawForImageExport) {            // remove redrawing method such that only current view is exported
                this.drawForImageExport = null;
            }
        });
    }
    currentFigure = figuresDict[newMetric];
    connect_manager(serverURL, figuresDict[newMetric]);
    $('#' + newMetric).show();
    initMPLH5CanvasForExportAsImage(figuresDict[newMetric]);
}

/*
 * This is the callback that will get evaluated by an onClick event on the canvas through the mplh5 backend.
 */
function clickedDatatype(datatypeGid) {
    displayNodeDetails(datatypeGid);
}

/*
 * Update info on mouse over. This event is passed as a callback from the isocline python adapter.
 */
function hoverPlot(id, x, y, val) {
    $('#cursor_info_' + id).html('x axis:' + x + ' y axis:' + y + ' value:' + val);
}


function Isocline_MainDraw(groupGID, divId, width, height) {
    width = Math.floor(width);
    height = Math.floor(height);
    $('#' + divId).html('');
    doAjaxCall({
        type: "POST",
        url: '/burst/explore/draw_isocline_exploration/' + groupGID + '/' + width + '/' + height,
        success: function (r) {
            $('#' + divId).html(r);
        },
        error: function () {
            displayMessage("Could not refresh with the new metrics.", "errorMessage");
        }
    });
}


