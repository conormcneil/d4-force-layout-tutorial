var id,
    data,
    svg,
    ldd = 'particle',
    width = $(document).width() - 10,
    height = $(document).height() - 10,
    activeNode = null,
    tDuration = 1000, // transition duration (ms)
    // click event variables
    delay = 500, // double click delay (ms)
    clicks = 0,
    timer = null,
    // Edges (Lines)
    linkHighlightStroke = 'orange',
    linkHighlightStrokeWidth = '5px',
    linkStroke = 'black',
    linkStrokeWidth = '1px',
    // Nodes
    rx = 100, // x radius of ellipse
    ry = 30, // y radius of ellipse
    verticalOffset = 50,
    verticalPadding = 5,
    verticalSpacing = ry * 2 + verticalPadding,
    rootNodeFill = 'lightgreen',
    classNodeFill = 'lightblue',
    attributeNodeFill = 'white',
    nodeStroke = 'black',
    nodeStrokeWidth = '1px',
    nodeHighlightStroke = 'orange',
    nodeHighlightStrokeWidth = '5px',
    activeNodes = [],
    nodeGen = [],
    nodes = null,
    links = null,
    rootNodes = [],
    lidType = null,
    zoomScale = [0.1, 10],
    tree = d3.tree()
        .size([height, width]),
    zoomBounds = [
        [-20 * width, -10 * height],
        [10 * width, 40 * height]
    ]; // [[-x,y],[x,-y]]

initGrid();

getJson(ldd);

function getJson(id) {
    $.ajax({
        type: "POST",
        url: 'http://localhost:3000/',
        data: {
            id: id
        },
        success: main
    });
};

function main(json) {
    data = new Data(json);

    // remove old tree
    d3.select('.tree').remove();

    svg = d3.select('.main')
        .append('g')
        .attr('class', 'tree');

    update();
};

function update() {
    var tIn = d3.transition()
        .duration(1000);

    var tOut = d3.transition()
        .duration(1000);

    var link = svg.selectAll('.link')
        .data(data.links, function(l) {
            let lidId = `${l.source}.${l.target}`
            return lidId;
        });

    var node = svg.selectAll('g')
        .data(data.nodes,function(d) {
            let lidId;
            
            try {
                lidId = d['local_identifier'][0];
            } catch (err) {
                lidId = d['identifier_reference'][0];
            }
            
            return lidId;
        });

    var linkEnter = link
        .enter().append('path')
        .attr('class', 'link')
        .style('opacity',1e-6);
    
    linkEnter.transition(tIn)
        .delay(100)
        .style('opacity',1);

    var nodeEnter = node
        .enter().append('g')
        .classed('node', true)
        .on('click', click)
        .attr('id', function(d) {
            let _id;

            try {
                _id = d['local_identifier'][0].replace('.', '-');
            } catch (err) {
                _id = d['identifier_reference'][0].replace('.', '-');
            }

            return _id;
        })
        .style('opacity',1e-6);
    
    nodeEnter.transition(tIn)
        .style('opacity',1)
    
    // configure behavior when nodes enter
    // append ellipse to each node group
    nodeEnter
        .append('ellipse')
        .attr('class', 'circle')
        .style('stroke', nodeStroke)
        .style('fill', highlightNode)
        .attr('rx',1e-6)
        .attr('ry',1e-6)
        .transition(tIn)
        .attr('rx', rx)
        .attr('ry', ry)
        
    // append text to each node group
    nodeEnter
        .append('text')
        .text(function(d) {
            return d.name[0];
        })
        .style('font-size', function(d) {
            let maths = Math.min(2 * ry, (2 * ry) / this.getComputedTextLength() * 40);
            return `${maths}px`;
        })
        .attr('dx', '-75px')
        .attr('dy', '.25em')
        .style('opacity',1e-6)
        .transition(tIn)
        .delay(750)
        .style('opacity',1);
    nodeEnter
        .attr('transform', function(d, idx) {
            // configure horiontal (x) position
            let colWidth = 500;
            let xOffset = 300;

            if (d.rootNode) d.x = colWidth - xOffset;
            else d.x = d.col * colWidth - xOffset;

            // configure vertical (y) position
            d.y = verticalOffset + idx * verticalSpacing;
            return `translate(${d.x},${d.y})`;
        });

    // configure behavior when links enter
    linkEnter
        .attr('d', d3.linkHorizontal()
            .x(function(d) {
                return getNodeByIdx(d).x;
            })
            .y(function(d) {
                return getNodeByIdx(d).y;
            })
        )
        .attr('fill', 'none')
        .attr('stroke', linkStroke)
        .attr('stroke-width', linkStrokeWidth);
    
    var linkExit = link.exit()
        .transition(tOut)
        .style('opacity',1e-6)
        .remove();
    
    var nodeExit = node.exit()
        .transition(tOut)
        .style('opacity',1e-6)
        .remove();
};

function initGrid() {
    var sim = d3.select('svg')
        .attr('width', width)
        .attr('height', height);

    var zoom = d3.zoom()
        .scaleExtent(zoomScale)
        .translateExtent(zoomBounds)
        .on('zoom', zoomed);

    var x = d3.scaleLinear()
        .domain([-1, width + 1])
        .range([-1, width + 1]);

    var y = d3.scaleLinear()
        .domain([-1, height + 1])
        .range([-1, height + 1]);

    var xAxis = d3.axisBottom(x)
        .ticks((width + 2) / (height + 2) * 10)
        .tickSize(height)
        .tickPadding(8 - height);

    var yAxis = d3.axisRight(y)
        .ticks(10)
        .tickSize(width)
        .tickPadding(8 - width);

    var gX = sim.append('g')
        .attr('class', 'axis axis--x')
        .call(xAxis);

    var gY = sim.append('g')
        .attr('class', 'axis axis--y')
        .call(yAxis);

    sim.call(zoom)
        .on('dblclick.zoom', null);

    function zoomed() {
        gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
        gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
        svg.attr('transform', d3.event.transform);
    };
};

function toggleNodes(node) {
    activeNodes = [];

    let g1 = [node];
    let g2 = nextGen(g1);
    let g3 = nextGen(g2);

    if (activeNode == node) {
        activeNode = null;
        nodeGen = [];
    } else {
        nodeGen = g1.concat(g2);
        activeNode = node;
        activeNodes = activeNodes
            .concat(g1)
            .concat(g2)
            .concat(g3);
    }

    svg.selectAll('.link')
        .style('stroke', function(link) {
            let _lid = getNodeByIdx(link.source)['local_identifier'][0];

            return nodeGen.find(d => {
                try {
                    return d['local_identifier'][0] == _lid;
                } catch (err) {
                    return d['identifier_reference'][0] == _lid;
                }
            }) ? linkHighlightStroke : linkStroke;
        })
        .style('stroke-width', function(link) {
            let _lid = getNodeByIdx(link.source)['local_identifier'][0];

            return nodeGen.find(d => {
                try {
                    return d['local_identifier'][0] == _lid;
                } catch (err) {
                    return d['identifier_reference'][0] == _lid;
                }
            }) ? linkHighlightStrokeWidth : linkStrokeWidth;
        });

    svg.selectAll('.circle')
        .style('stroke', function(d) {
            let _lid;

            try {
                _lid = d['local_identifier'][0];
            } catch (err) {
                _lid = d['identifier_reference'][0];
            }

            return activeNodes.find(e => {
                try {
                    return e['local_identifier'][0] == _lid;
                } catch (err) {
                    return e['identifier_reference'][0] == _lid;
                }
            }) ? nodeHighlightStroke : nodeStroke;
        })
        .style('stroke-width', function(d) {
            let _lid;

            try {
                _lid = d['local_identifier'][0];
            } catch (err) {
                _lid = d['identifier_reference'][0];
            }

            return activeNodes.find(e => {
                try {
                    return e['local_identifier'][0] == _lid;
                } catch (err) {
                    return e['identifier_reference'][0] == _lid;
                }
            }) ? nodeHighlightStrokeWidth : nodeStrokeWidth;
        })
};

function highlightNode(n) {
    let _color,
        _lid;

    try {
        _lid = n['local_identifier'][0];
    } catch (err) {
        _lid = n['identifier_reference'][0];
    }

    if (n.rootNode) _color = rootNodeFill;
    else if (n.className == 'class') _color = classNodeFill;
    else _color = attributeNodeFill;

    return _color;
};

function nextGen(parent) {
    let _nextGen = [];

    data.links.map(link => {
        let source = getNodeByIdx(link.source);
        let target = getNodeByIdx(link.target);

        if (parent && parent.indexOf(source) != -1 && _nextGen.indexOf(target) == -1) {
            _nextGen.push(target);
        }
    });

    return _nextGen;
};

function getNodeByIdx(nodeIdx) {
    return data.nodes[nodeIdx];
};

function click(event) {
    clicks++; //count clicks

    if (clicks === 1) {
        toggleNodes(event);
        // first click
        timer = setTimeout(function() {
            clicks = 0; // reset counter
        }, delay);
    } else {
        // second click
        clearTimeout(timer); // prevent single-click action
        clicks = 0; // after action performed, reset counter
        if (!activeNode) toggleNodes(event);
        // TODO toggle d3 and form
        newModal(event);
    }
};