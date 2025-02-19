let currentMasterSpace = 'RGB'; // Can be 'RGB', 'HSL', or 'LAB'
let angle = 0;
let selectedPoint = null;
let curvePoints = [];
const numCurvePoints = 50;
let dragMode = 'snap'; // Can be 'free' or 'snap'
let bezierPoints = {
    RGB: [
        { x: 0, y: 0, z: 0 },          // Start point
        { x: 85, y: 85, z: 85 },       // Control point 1
        { x: 170, y: 170, z: 170 },    // Control point 2
        { x: 255, y: 255, z: 255 }     // End point
    ],
    HSL: [
        { x: 0, y: 50, z: 50 },
        { x: 90, y: 50, z: 50 },
        { x: 270, y: 50, z: 50 },
        { x: 360, y: 50, z: 50 }
    ],
    LAB: [
        { x: 0, y: 0, z: 0 },
        { x: 25, y: 40, z: 40 },
        { x: 75, y: -40, z: -40 },
        { x: 100, y: 0, z: 0 }
    ]
};

let paletteColors = [];
const NUM_COLORS = 5;

let cameraRotations = {
    RGB: { x: 0, y: 0 },
    HSL: { x: 0, y: 0 },
    LAB: { x: 0, y: 0 }
};

let rgbGraphics, hslGraphics, labGraphics;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startRotationX = 0;
let startRotationY = 0;

let hoveredPoint = null;

const CAMERA_Z = 1200;  // You may experiment with this value
const SCENE_SCALE = 0.8; // Adjust to shrink or expand the 3D distribution

let showDebugInfo = false;  // Debug flag, default to false

// Base design dimensions (palette remains drawn at bottom)
const BASE_CANVAS_HEIGHT = 400; // (used in drawPalette)

let cnv; // Global canvas so we can reposition it on windowResized

// Global drag snapping variables
let dragSnapAxis = null;
let dragStartWorld = null;
let dragStartScreenPos = null;

// Add a new global variable for tracking hovered axis
let hoveredAxis = null;

// Add global font variable
let font;

/**
 * Returns a uniform scaling factor based on the size of the secondary viewports.
 * Since non-primary viewports are squares of side (height/2) and were designed
 * with a base width of 400 in mind, we compute:
 *    scale = (height/2)/400.
 */
function getUniformScaleFactor() {
    return (height / 2) / 400;
}

// Setup the p5.Graphics buffer's perspective.
function setupGraphics(g) {
    g.clear();
    g.setAttributes('alpha', true);
    g.perspective(PI / 8, g.width / g.height, 0.1, 19000);
    g.camera(0, 0, 1600, 0, 0, 0, 0, 1, 0);
}

// Return the desired buffer size for a given color space.
function getDesiredBufferSize(space) {
    // Our non-primary viewports are squares of side (height/2)
    let nonPrimaryWidth = height / 2;
    let primaryWidth = width - nonPrimaryWidth;
    if (space === currentMasterSpace) {
        return { w: primaryWidth, h: height };
    } else {
        return { w: nonPrimaryWidth, h: height / 2 };
    }
}

// Updates the offscreen p5.Graphics buffers if the main canvas dimensions changed.
function updateBufferSizes() {
    let rgbSize = getDesiredBufferSize('RGB');
    let hslSize = getDesiredBufferSize('HSL');
    let labSize = getDesiredBufferSize('LAB');
    
    setAttributes('alpha', true);
    
    if (rgbGraphics && (rgbGraphics.width !== rgbSize.w || rgbGraphics.height !== rgbSize.h)) {
        rgbGraphics = createGraphics(rgbSize.w, rgbSize.h, WEBGL);
        setupGraphics(rgbGraphics);
    }
    if (hslGraphics && (hslGraphics.width !== hslSize.w || hslGraphics.height !== hslSize.h)) {
        hslGraphics = createGraphics(hslSize.w, hslSize.h, WEBGL);
        setupGraphics(hslGraphics);
    }
    if (labGraphics && (labGraphics.width !== labSize.w || labGraphics.height !== labSize.h)) {
        labGraphics = createGraphics(labSize.w, labSize.h, WEBGL);
        setupGraphics(labGraphics);
    }
}

function preload() {
    // Load font from CDN
    font = loadFont('https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceCodePro-Bold.otf');
}

function setup() {
    // Use the full available window dimensions.
    cnv = createCanvas(windowWidth, windowHeight);
    cnv.position(0, 0);

    // Set WebGL attributes globally before creating graphics
    setAttributes('alpha', true);

    // Initialize rotations for each color space.
    Object.keys(cameraRotations).forEach(space => {
        cameraRotations[space] = {
            x: -PI / 6,
            y: PI / 4
        };
    });
    
    // Create and setup graphics buffers.
    // The primary (selected) viewport is on the left:
    let nonPrimaryWidth = height / 2; // width of the right column (each non-primary viewport is a square)
    let primaryWidth = width - nonPrimaryWidth;
    
    rgbGraphics = createGraphics(primaryWidth, height, WEBGL);
    hslGraphics = createGraphics(nonPrimaryWidth, height / 2, WEBGL);
    labGraphics = createGraphics(nonPrimaryWidth, height / 2, WEBGL);
    
    setupGraphics(rgbGraphics);
    setupGraphics(hslGraphics);
    setupGraphics(labGraphics);
    
    // Reset drag state.
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
    startRotationX = -PI / 6;
    startRotationY = PI / 4;
    
    createSpaceSelector();
    createRandomizeButton();
    randomizePalette();
}

function createRandomizeButton() {
    let button = createButton('Randomize');
    button.position(150, 10);
    button.mousePressed(randomizePalette);
}

function randomizePalette() {
    switch(currentMasterSpace) {
        case 'RGB':
            for(let i = 0; i < 4; i++) {
                bezierPoints.RGB[i] = {
                    x: random(0, 255),
                    y: random(0, 255),
                    z: random(0, 255)
                };
            }
            break;
        case 'HSL':
            for(let i = 0; i < 4; i++) {
                bezierPoints.HSL[i] = {
                    x: random(0, 360),
                    y: random(30, 70),
                    z: random(30, 70)
                };
            }
            break;
        case 'LAB':
            for(let i = 0; i < 4; i++) {
                bezierPoints.LAB[i] = {
                    x: random(0, 100),
                    y: random(-128, 127),
                    z: random(-128, 127)
                };
            }
            break;
    }
    calculatePaletteColors();
}

function calculatePaletteColors() {
    paletteColors = [];
    const points = bezierPoints[currentMasterSpace];
    
    for (let i = 0; i < NUM_COLORS; i++) {
        const t = i / (NUM_COLORS - 1);
        const point = {
            x: bezierLerp(points[0].x, points[1].x, points[2].x, points[3].x, t),
            y: bezierLerp(points[0].y, points[1].y, points[2].y, points[3].y, t),
            z: bezierLerp(points[0].z, points[1].z, points[2].z, points[3].z, t)
        };
        point.color = getColorFromSpace(point, currentMasterSpace);
        paletteColors.push(point);
    }
    
    calculateCurvePoints();
}

function bezierLerp(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    return p0 * mt3 + 3 * p1 * mt2 * t + 3 * p2 * mt * t2 + p3 * t3;
}

function calculateCurvePoints() {
    curvePoints = [];
    const points = bezierPoints[currentMasterSpace];
    for (let i = 0; i < numCurvePoints; i++) {
        let t = i / (numCurvePoints - 1);
        let pt = {
            x: bezierLerp(points[0].x, points[1].x, points[2].x, points[3].x, t),
            y: bezierLerp(points[0].y, points[1].y, points[2].y, points[3].y, t),
            z: bezierLerp(points[0].z, points[1].z, points[2].z, points[3].z, t)
        };
        pt.color = getColorFromSpace(pt, currentMasterSpace);
        curvePoints.push(pt);
    }
}

function createSpaceSelector() {
    let selector = createSelect();
    selector.position(10, 10);
    selector.option('RGB');
    selector.option('HSL');
    selector.option('LAB');
    selector.changed(() => {
        currentMasterSpace = selector.value();
        calculatePaletteColors();
    });
}

function draw() {
    background(40);
    updateBufferSizes();
    
    // For layout, we use the following:
    // - The left side is the primary viewport (the currentMasterSpace) which takes full canvas height.
    // - The right column (width = height/2) contains the two remaining color spaces,
    //   one in the top half, the other in the bottom half.
    let nonPrimaryWidth = height / 2;
    let primaryWidth = width - nonPrimaryWidth;
    
    // Draw primary viewport on the left.
    if (currentMasterSpace === 'RGB') {
        drawRGBViewport(0, 0, primaryWidth, height);
    } else if (currentMasterSpace === 'HSL') {
        drawHSLViewport(0, 0, primaryWidth, height);
    } else if (currentMasterSpace === 'LAB') {
        drawLABViewport(0, 0, primaryWidth, height);
    }
    
    // Determine which of the two remaining color spaces to draw in the right column.
    let nonPrimarySpaces = ['RGB', 'HSL', 'LAB'].filter(space => space !== currentMasterSpace);
    
    // Top non-primary: (right column, top half).
    if (nonPrimarySpaces[0] === 'RGB'){
        drawRGBViewport(primaryWidth, 0, nonPrimaryWidth, height / 2);
    } else if (nonPrimarySpaces[0] === 'HSL') {
        drawHSLViewport(primaryWidth, 0, nonPrimaryWidth, height / 2);
    } else if (nonPrimarySpaces[0] === 'LAB') {
        drawLABViewport(primaryWidth, 0, nonPrimaryWidth, height / 2);
    }
    
    // Bottom non-primary: (right column, bottom half).
    if (nonPrimarySpaces[1] === 'RGB'){
        drawRGBViewport(primaryWidth, height / 2, nonPrimaryWidth, height / 2);
    } else if (nonPrimarySpaces[1] === 'HSL') {
        drawHSLViewport(primaryWidth, height / 2, nonPrimaryWidth, height / 2);
    } else if (nonPrimarySpaces[1] === 'LAB') {
        drawLABViewport(primaryWidth, height / 2, nonPrimaryWidth, height / 2);
    }
    
    drawPalette();
    drawDebugInfo();
    
    // If hovering over an RGB control point, draw the RGB text values.
    if (currentMasterSpace === 'RGB') {
        let pt = (hoveredPoint !== null) ? bezierPoints.RGB[hoveredPoint] :
                 (selectedPoint !== null ? bezierPoints.RGB[selectedPoint] : null);
        if (pt) {
            drawAxisValue2D(pt, 'x');
            drawAxisValue2D(pt, 'y');
            drawAxisValue2D(pt, 'z');
        }
    }
    
    // update hover states continuously
    mouseMoved();
}

function drawPalette() {
    // Scale the palette height relative to canvas height
    let paletteHeight = height / 10;
    let swatchWidth = width / NUM_COLORS;
    
    for (let i = 0; i < paletteColors.length; i++) {
        const x = i * swatchWidth;
        fill(paletteColors[i].color);
        noStroke();
        rect(x, height - paletteHeight, swatchWidth, paletteHeight);
    }
}

function drawRGBViewport(x, y, w, h) {
    rgbGraphics.clear();
    rgbGraphics.background(40);
    
    // Apply camera and rotation.
    rgbGraphics.resetMatrix();
    rgbGraphics.camera(0, 0, 1600, 0, 0, 0, 0, 1, 0);
    rgbGraphics.rotateX(cameraRotations.RGB.x);
    rgbGraphics.rotateY(cameraRotations.RGB.y);
    
    // *** Apply the uniform scale so that stroke widths and sphere sizes
    //     match those in the secondary viewports.
    rgbGraphics.push();
    rgbGraphics.scale(getUniformScaleFactor());
    
    drawRGBCube(rgbGraphics);
    drawCurveInRGBSpace(rgbGraphics);
    
    if (currentMasterSpace === 'RGB') {
        drawControlPoints(bezierPoints.RGB, rgbGraphics);
    }
    rgbGraphics.pop();
    
    image(rgbGraphics, x, y, w, h);
}

function drawHSLViewport(x, y, w, h) {
    hslGraphics.clear();
    hslGraphics.background(40);
    
    hslGraphics.resetMatrix();
    hslGraphics.camera(0, 0, 1600, 0, 0, 0, 0, 1, 0);
    hslGraphics.rotateX(cameraRotations.HSL.x);
    hslGraphics.rotateY(cameraRotations.HSL.y);
    
    // Apply uniform scale for consistent element sizes.
    hslGraphics.push();
    hslGraphics.scale(getUniformScaleFactor());
    
    drawHSLCylinder(hslGraphics);
    drawCurveInHSLSpace(hslGraphics);
    
    if (currentMasterSpace === 'HSL') {
        drawControlPoints(bezierPoints.HSL, hslGraphics);
    }
    hslGraphics.pop();
    
    image(hslGraphics, x, y, w, h);
}

function drawLABViewport(x, y, w, h) {
    labGraphics.clear();
    labGraphics.background(40);
    
    labGraphics.resetMatrix();
    labGraphics.camera(0, 0, 1600, 0, 0, 0, 0, 1, 0);
    labGraphics.rotateX(cameraRotations.LAB.x);
    labGraphics.rotateY(cameraRotations.LAB.y);
    
    // Apply uniform scale to match the secondary viewports.
    labGraphics.push();
    labGraphics.scale(getUniformScaleFactor());
    
    drawLABSpace(labGraphics);
    drawCurveInLABSpace(labGraphics);
    
    if (currentMasterSpace === 'LAB') {
        drawControlPoints(bezierPoints.LAB, labGraphics);
    }
    labGraphics.pop();
    
    image(labGraphics, x, y, w, h);
}

function drawCurveInRGBSpace(g) {
    g.push();
    g.noFill();
    
    // Draw the bezier curve.
    g.beginShape();
    curvePoints.forEach(point => {
        g.stroke(point.color);
        g.strokeWeight(1);
        g.vertex(point.x - 127.5, point.y - 127.5, point.z - 127.5);
    });
    g.endShape();
    
    // Draw palette points on the curve.
    paletteColors.forEach(point => {
        g.push();
        g.translate(point.x - 127.5, point.y - 127.5, point.z - 127.5);
        g.noStroke();
        g.fill(point.color);
        let sphereSize = 5 * getUniformScaleFactor();
        g.sphere(sphereSize);
        g.pop();
    });
    
    g.pop();
}

function drawCurveInHSLSpace(g) {
    g.push();
    g.noFill();
    
    // Draw the bezier curve in HSL space using custom mapping.
    g.beginShape();
    curvePoints.forEach(point => {
        const rgbColor = getColorFromSpace(point, currentMasterSpace);
        const hslColor = RGBtoHSL(red(rgbColor), green(rgbColor), blue(rgbColor));
        g.stroke(rgbColor);
        g.strokeWeight(1);
        
        const radius = hslColor.s * 150;
        const angle = (hslColor.h / 360) * TWO_PI;
        const x = cos(angle) * radius;
        const z = sin(angle) * radius;
        const y = (hslColor.l * 300) - 150;
        
        g.vertex(x, y, z);
    });
    g.endShape();
    
    // Draw palette points.
    paletteColors.forEach(point => {
        const rgbColor = point.color;
        const hslColor = RGBtoHSL(red(rgbColor), green(rgbColor), blue(rgbColor));
        
        const radius = hslColor.s * 150;
        const angle = (hslColor.h / 360) * TWO_PI;
        const x = cos(angle) * radius;
        const z = sin(angle) * radius;
        const y = (hslColor.l * 300) - 150;
        
        g.push();
        g.translate(x, y, z);
        g.noStroke();
        g.fill(rgbColor);
        let sphereSize = 5 * getUniformScaleFactor();
        g.sphere(sphereSize);
        g.pop();
    });
    
    g.pop();
}

function drawCurveInLABSpace(g) {
    g.push();
    g.noFill();
    
    // Draw the bezier curve in LAB space with updated coordinate mapping.
    g.beginShape();
    curvePoints.forEach(point => {
        const rgbColor = getColorFromSpace(point, currentMasterSpace);
        const labColor = RGBtoLAB(red(rgbColor), green(rgbColor), blue(rgbColor));
        g.stroke(rgbColor);
        g.strokeWeight(1);
        
        const x = labColor.a * 2;
        const y = (labColor.l - 50) * 2;
        const z = labColor.b * 2;
        
        g.vertex(x, y, z);
    });
    g.endShape();
    
    // Draw palette points.
    paletteColors.forEach(point => {
        const rgbColor = point.color;
        const labColor = RGBtoLAB(red(rgbColor), green(rgbColor), blue(rgbColor));
        
        const x = labColor.a * 2;
        const y = (labColor.l - 50) * 2;
        const z = labColor.b * 2;
        
        g.push();
        g.translate(x, y, z);
        g.noStroke();
        g.fill(rgbColor);
        let sphereSize = 5 * getUniformScaleFactor();
        g.sphere(sphereSize);
        g.pop();
    });
    
    g.pop();
}

// Updated control point drawing: on hover or selection.
function drawControlPoints(points, g) {
    const freeHoverThreshold = 15 * getUniformScaleFactor(); // active free hover radius
    points.forEach((point, index) => {
        if (selectedPoint === index || hoveredPoint === index) {
            g.push();
            if (currentMasterSpace === 'RGB') {
                // Move to the control point inside the RGB cube.
                g.translate(point.x - 127.5, point.y - 127.5, point.z - 127.5);
                
                // Use the primary viewport for the RGB control points.
                const viewportForPoint = { x: 0, y: 0, w: width - height / 2, h: height, space: currentMasterSpace };
                let screenPos = getScreenPosition(point, viewportForPoint);
                let d = dist(mouseX, mouseY, screenPos.x, screenPos.y);
                
                // Condition for free visualization:
                // a) If mouse is pressed and dragMode is 'free', always show free visualization,
                // or b) if mouse is not pressed and pointer is within freeHoverThreshold.
                if ((mouseIsPressed && dragMode === 'free') || (!mouseIsPressed && d < freeHoverThreshold)) {
                    // Free visualization: only draw the two gradient lines and use a smaller sphere.
                    drawAxisLinesRGB_FreeHover(g, point);
                    var sphereSize = 5 * getUniformScaleFactor();
                } else {
                    // Default visualization: show all axis lines and use a larger sphere.
                    drawAxisLinesRGB(g, point);
                    var sphereSize = 5 * getUniformScaleFactor() * 1.35;
                }
            } else if (currentMasterSpace === 'HSL') {
                // Existing HSL behavior.
                let x = cos((point.x / 360) * TWO_PI) * point.y * 1.5;
                let z = sin((point.x / 360) * TWO_PI) * point.y * 1.5;
                let y = point.z * 3 - 150;
                g.translate(x, y, z);
                var sphereSize = 5 * getUniformScaleFactor() * 1.35;
            } else if (currentMasterSpace === 'LAB') {
                g.translate(point.y * 2, (point.x - 50) * 2, point.z * 2);
                var sphereSize = 5 * getUniformScaleFactor() * 1.35;
            }
            
            g.noStroke();
            g.fill(getColorFromSpace(point, currentMasterSpace));
            g.sphere(sphereSize);
            
            g.pop();
        }
    });
}

// New helper function to draw a gradient line in 3D.
// This subdivides the line into several segments and interpolates the color.
function drawGradientLine(g, startVec, endVec, colorStart, colorEnd, segments, weight) {
    for (let i = 0; i < segments; i++) {
        let t1 = i / segments;
        let t2 = (i + 1) / segments;
        let x1 = lerp(startVec.x, endVec.x, t1);
        let y1 = lerp(startVec.y, endVec.y, t1);
        let z1 = lerp(startVec.z, endVec.z, t1);
        let x2 = lerp(startVec.x, endVec.x, t2);
        let y2 = lerp(startVec.y, endVec.y, t2);
        let z2 = lerp(startVec.z, endVec.z, t2);
        let col = lerpColor(colorStart, colorEnd, t1);
        g.push();
            g.stroke(col);
            g.strokeWeight(weight);
            g.line(x1, y1, z1, x2, y2, z2);
        g.pop();
    }
}

// Updated drawAxisLinesRGB:
// Instead of fixed solid-color lines, draw gradient lines for each axis.
// For each axis, the control point determines the fixed R, G, or B components,
// and the line gradient spans the full range (0 - 255) for the corresponding channel.
// Also, the lines are semi-transparent and thinner than the cube edges.
function drawAxisLinesRGB(g, point) {
    let segments = 20;
    let isDragging = selectedPoint !== null;
    
    // For each axis, if active, use a higher weight (activeWeight) otherwise use a base weight.
    // In this update, the lower segment (from 0 to the sphere) is drawn with 2.0× the base weight,
    // while the upper segment (from the sphere to 255) uses the base weight.
    
    // X axis
    if (!isDragging || dragSnapAxis === 'x') {
        let axisAlpha = (dragSnapAxis === 'x' ? 255 : 150);
        let axisWeightFactor = (dragSnapAxis === 'x' ? 1.0 : 1);
        let lowerWeight = axisWeightFactor * 4.0; // Thicker part from 0 to sphere
        let upperWeight = axisWeightFactor;       // Thinner part from sphere to 255
        
        let xStart = -point.x;
        let xEnd = 255 - point.x;
        
        // Lower segment: from the lower extreme (xStart) to the sphere's center (0,0,0)
        drawGradientLine(
            g,
            createVector(xStart, 0, 0),
            createVector(0, 0, 0),
            color(0, point.y, point.z, axisAlpha),
            color(point.x, point.y, point.z, axisAlpha),
            segments,
            lowerWeight
        );
        
        // Upper segment: from the sphere's center (0,0,0) to the positive extreme (xEnd)
        drawGradientLine(
            g,
            createVector(0, 0, 0),
            createVector(xEnd, 0, 0),
            color(point.x, point.y, point.z, axisAlpha),
            color(255, point.y, point.z, axisAlpha),
            segments,
            upperWeight
        );
        
        if (hoveredPoint !== null && !isDragging) {
            drawAxisValue2D(point, 'x');
        }
    }
    
    // Y axis
    if (!isDragging || dragSnapAxis === 'y') {
        let axisAlpha = (dragSnapAxis === 'y' ? 255 : 150);
        let axisWeightFactor = (dragSnapAxis === 'y' ? 1.0 : 1);
        let lowerWeight = axisWeightFactor * 4.0;
        let upperWeight = axisWeightFactor;
        
        let yStart = -point.y;
        let yEnd = 255 - point.y;
        
        drawGradientLine(
            g,
            createVector(0, yStart, 0),
            createVector(0, 0, 0),
            color(point.x, 0, point.z, axisAlpha),
            color(point.x, point.y, point.z, axisAlpha),
            segments,
            lowerWeight
        );
        drawGradientLine(
            g,
            createVector(0, 0, 0),
            createVector(0, yEnd, 0),
            color(point.x, point.y, point.z, axisAlpha),
            color(point.x, 255, point.z, axisAlpha),
            segments,
            upperWeight
        );
                         
        if (hoveredPoint !== null && !isDragging) {
            drawAxisValue2D(point, 'y');
        }
    }
    
    // Z axis
    if (!isDragging || dragSnapAxis === 'z') {
        let axisAlpha = (dragSnapAxis === 'z' ? 255 : 150);
        let axisWeightFactor = (dragSnapAxis === 'z' ? 1.0 : 1);
        let lowerWeight = axisWeightFactor * 4.0;
        let upperWeight = axisWeightFactor;
        
        let zStart = -point.z;
        let zEnd = 255 - point.z;
        
        drawGradientLine(
            g,
            createVector(0, 0, zStart),
            createVector(0, 0, 0),
            color(point.x, point.y, 0, axisAlpha),
            color(point.x, point.y, point.z, axisAlpha),
            segments,
            lowerWeight
        );
        drawGradientLine(
            g,
            createVector(0, 0, 0),
            createVector(0, 0, zEnd),
            color(point.x, point.y, point.z, axisAlpha),
            color(point.x, point.y, 255, axisAlpha),
            segments,
            upperWeight
        );
                         
        if (hoveredPoint !== null && !isDragging) {
            drawAxisValue2D(point, 'z');
        }
    }
}

// Helper function to determine which faces of the cube are visible
function getVisibleFaces(rotation) {
    let faces = {
        front: rotation.y > -PI/2 && rotation.y < PI/2,
        right: rotation.y < 0,
        back: rotation.y < -PI/2 || rotation.y > PI/2,
        left: rotation.y > 0,
        top: rotation.x < 0,
        bottom: rotation.x > 0
    };
    return faces;
}

// Helper function to draw RGB values at axis intersections
function drawAxisValue2D(point, axis) {
    if (!font) return;
    
    // Determine state: dragging or hovered
    const isDragging = (selectedPoint !== null);
    const isHovered = (!isDragging && hoveredPoint !== null);
    
    // When dragging, only show the active (snapped) axis value
    if (isDragging && dragSnapAxis !== axis) {
        return;
    }
    // When not dragging, only the hovered point should show text
    if (!isDragging && !isHovered) {
        return;
    }
    
    // For the dragged axis, use the current point value (not the start value)
    let effectivePoint = { ...point };
    
    let value, label;
    // Calculate visible faces based on camera rotation
    let faces = getVisibleFaces(cameraRotations[currentMasterSpace]);
    
    // Determine which face to use for each axis based on camera rotation
    let worldIntersection = {
        x: effectivePoint.x,
        y: effectivePoint.y,
        z: effectivePoint.z
    };

    switch (axis) {
        case 'x':
            value = Math.round(effectivePoint.x);
            label = 'Red';
            // Place on right face if visible, otherwise left face
            worldIntersection.x = faces.right ? 255 : 0;
            break;
        case 'y':
            value = Math.round(effectivePoint.y);
            label = 'Green';
            // Place on bottom face if visible, otherwise top face
            worldIntersection.y = faces.bottom ? 255 : 0;
            break;
        case 'z':
            value = Math.round(effectivePoint.z);
            label = 'Blue';
            // Place on front face if visible, otherwise back face
            worldIntersection.z = faces.front ? 255 : 0;
            break;
    }
    
    // Set opacity to match the axis state
    let alphaValue;
    if (isDragging) {
        alphaValue = dragSnapAxis === axis ? 255 : 100;
    } else if (isHovered) {
        alphaValue = hoveredAxis === axis ? 255 : 150;
    } else {
        alphaValue = 150;
    }
    
    // Adjust alpha based on whether this is the currently hovered/dragged axis
    if (hoveredAxis === axis || dragSnapAxis === axis) {
        alphaValue = 255;
    } else {
        alphaValue = 150;
    }
    
    // Define the viewport
    let nonPrimaryWidth = height / 2;
    let primaryWidth = width - nonPrimaryWidth;
    let viewport = { x: 0, y: 0, w: primaryWidth, h: height, space: currentMasterSpace };
    
    // Convert the chosen cube face point into screen coordinates
    let screenPos = getScreenPosition(worldIntersection, viewport);
    
    push();
        resetMatrix();
        textFont(font);
        textSize(12); // Reduced text size (80% of original 16px)
        textStyle(NORMAL); // Non-bold text
        fill(255, alphaValue);
        textAlign(CENTER, CENTER);
        text(`${label}: ${value}`, screenPos.x, screenPos.y);
    pop();
}

function getColorFromSpace(point, space) {
    switch (space) {
        case 'RGB':
            return color(point.x, point.y, point.z);
        case 'HSL':
            return colorFromHSL(point.x, point.y, point.z);
        case 'LAB':
            return colorFromLAB(point.x, point.y, point.z);
        default:
            return color(0);
    }
}

function colorFromHSL(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    
    if (h >= 0 && h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }
    
    return color((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function colorFromLAB(l, a, b) {
    const normalizedL = l / 100;
    const normalizedA = (a + 128) / 255;
    const normalizedB = (b + 128) / 255;
    
    return color(
        normalizedL * 255,
        normalizedA * 255,
        normalizedB * 255
    );
}

function mouseDragged() {
    const viewport = getCurrentViewport();
    if (!viewport || mouseY < 0 || mouseY > height || mouseX < 0 || mouseX > width) {
        isDragging = false;
        return;
    }
    
    if (selectedPoint !== null) {
        let point = bezierPoints[currentMasterSpace][selectedPoint];
        
        if (dragMode === 'free' && currentMasterSpace === 'RGB') {
            // ----------- Free-drag mode using camera alignment -----------
            // Get the current camera rotation.
            let rotation = cameraRotations[currentMasterSpace];
            // Compute the rotated basis vectors of the world.
            let rx = rotatePoint(new p5.Vector(1, 0, 0), rotation.x, rotation.y);
            let ry = rotatePoint(new p5.Vector(0, 1, 0), rotation.x, rotation.y);
            let rz = rotatePoint(new p5.Vector(0, 0, 1), rotation.x, rotation.y);
            // The camera's view direction in our setup is down the negative Z.
            const viewDir = new p5.Vector(0, 0, -1);
            
            // Compute alignment of each axis with the viewing direction.
            // (A higher absolute dot product means more aligned with the camera.)
            let alignX = abs(rx.dot(viewDir));
            let alignY = abs(ry.dot(viewDir));
            let alignZ = abs(rz.dot(viewDir));
            
            // The axis with the highest alignment is considered fixed (does not move).
            let fixedAxis = 'x';
            if (alignY > alignX && alignY > alignZ) {
                fixedAxis = 'y';
            } else if (alignZ > alignX && alignZ > alignY) {
                fixedAxis = 'z';
            }
            let freeAxes = ['x', 'y', 'z'].filter(axis => axis !== fixedAxis);
            
            // For each free axis, compute its corresponding screen–space vector.
            // We do this by projecting a unit offset along that axis.
            let freeBasis = {};
            freeAxes.forEach(axis => {
                let offsetPoint = Object.assign({}, dragStartWorld);
                offsetPoint[axis] += 1;
                let projectedOffset = getScreenPosition(offsetPoint, viewport);
                freeBasis[axis] = createVector(projectedOffset.x - dragStartScreenPos.x, projectedOffset.y - dragStartScreenPos.y);
            });
            
            // Current mouse drag in screen space.
            let currentDrag = createVector(mouseX - dragStartScreenPos.x, mouseY - dragStartScreenPos.y);
            let newPos = Object.assign({}, dragStartWorld);
            freeAxes.forEach(axis => {
                let basisVec = freeBasis[axis];
                let basisMag = basisVec.mag();
                if (basisMag !== 0) {
                    // Project currentDrag onto this free direction.
                    let basisUnit = basisVec.copy().normalize();
                    let projection = currentDrag.dot(basisUnit);
                    // Convert the screen projection back to a world delta.
                    let worldDelta = projection / basisMag;
                    newPos[axis] = dragStartWorld[axis] + worldDelta;
                }
            });
            // The fixed axis remains unchanged.
            newPos[fixedAxis] = dragStartWorld[fixedAxis];
            
            // Update the point and reapply constraints.
            point.x = newPos.x;
            point.y = newPos.y;
            point.z = newPos.z;
            constrainPoint(point, currentMasterSpace);
            calculatePaletteColors();
        } else {
            // ----------- Snap-drag (existing) behavior -----------
            if (!dragStartWorld || !dragStartScreenPos) {
                dragStartWorld = { x: point.x, y: point.y, z: point.z };
                dragStartScreenPos = getScreenPosition(point, viewport);
            }
            
            const threshold = 5;
            let currentDrag = createVector(mouseX - dragStartScreenPos.x, mouseY - dragStartScreenPos.y);
            if (dragSnapAxis === null && currentDrag.mag() > threshold) {
                let axes = [
                    { axis: 'x', offset: createVector(1, 0, 0) },
                    { axis: 'y', offset: createVector(0, 1, 0) },
                    { axis: 'z', offset: createVector(0, 0, 1) }
                ];
                let bestAxis = null;
                let bestDot = -Infinity;
                for (let candidate of axes) {
                    let testPoint = {
                        x: dragStartWorld.x + candidate.offset.x,
                        y: dragStartWorld.y + candidate.offset.y,
                        z: dragStartWorld.z + candidate.offset.z
                    };
                    let projected = getScreenPosition(testPoint, viewport);
                    let candidateScreen = createVector(projected.x - dragStartScreenPos.x, projected.y - dragStartScreenPos.y);
                    let candidateNorm = candidateScreen.copy().normalize();
                    let currentDragNorm = currentDrag.copy().normalize();
                    let dotVal = abs(candidateNorm.dot(currentDragNorm));
                    if (dotVal > bestDot) {
                        bestDot = dotVal;
                        bestAxis = candidate.axis;
                    }
                }
                dragSnapAxis = bestAxis;
            }
            if (dragSnapAxis !== null) {
                let offset;
                if (dragSnapAxis === 'x') {
                    offset = createVector(1, 0, 0);
                } else if (dragSnapAxis === 'y') {
                    offset = createVector(0, 1, 0);
                } else if (dragSnapAxis === 'z') {
                    offset = createVector(0, 0, 1);
                }
                let testPoint = {
                    x: dragStartWorld.x + offset.x,
                    y: dragStartWorld.y + offset.y,
                    z: dragStartWorld.z + offset.z
                };
                let projected = getScreenPosition(testPoint, viewport);
                let candidateScreen = createVector(projected.x - dragStartScreenPos.x, projected.y - dragStartScreenPos.y);
                let candidateLength = candidateScreen.mag();
                let candidateUnit = candidateScreen.copy().normalize();
                let dragProjection = currentDrag.dot(candidateUnit);
                let worldDelta = dragProjection / candidateLength;
                point[dragSnapAxis] = dragStartWorld[dragSnapAxis] + worldDelta;
                constrainPoint(point, currentMasterSpace);
                calculatePaletteColors();
            }
        }
    } else if (isDragging) {
        // Camera rotation dragging remains unchanged.
        const deltaX = (mouseX - dragStartX) * 0.01;
        const deltaY = (mouseY - dragStartY) * 0.01;
        
        cameraRotations[viewport.space].y = startRotationY + deltaX;
        cameraRotations[viewport.space].x = startRotationX - deltaY;
        cameraRotations[viewport.space].x = constrain(cameraRotations[viewport.space].x, -PI / 2, PI / 2);
    }
}

function mousePressed() {
    const viewport = getCurrentViewport();
    if (!viewport || mouseY < 0 || mouseY > height || mouseX < 0 || mouseX > width) return;

    selectedPoint = hoveredPoint;
    
    if (selectedPoint !== null) {
        // Determine which drag mode to use based on where the mouse clicked on the control sphere.
        let point;
        if (currentMasterSpace === 'RGB') {
            point = bezierPoints.RGB[selectedPoint];
        } else if (currentMasterSpace === 'HSL') {
            point = bezierPoints.HSL[selectedPoint];
        } else if (currentMasterSpace === 'LAB') {
            point = bezierPoints.LAB[selectedPoint];
        }
        // For RGB, use the primary viewport for the control points.
        const viewportForPoint = (currentMasterSpace === 'RGB')
            ? { x: 0, y: 0, w: width - height / 2, h: height, space: currentMasterSpace }
            : viewport;
        const screenPos = getScreenPosition(point, viewportForPoint);
        // Increase the free-drag threshold (in pixels) so clicks very near the center trigger free-drag.
        const freeDragThreshold = 15 * getUniformScaleFactor();
        const d = dist(mouseX, mouseY, screenPos.x, screenPos.y);
        dragMode = (d < freeDragThreshold) ? 'free' : 'snap';
        
        // Save the starting world coordinates and screen position.
        dragStartWorld = { x: point.x, y: point.y, z: point.z };
        dragStartScreenPos = screenPos;
    } else {
        isDragging = true;
        dragStartX = mouseX;
        dragStartY = mouseY;
        startRotationX = cameraRotations[viewport.space].x;
        startRotationY = cameraRotations[viewport.space].y;
    }
    
    updateCursor();
}

function mouseReleased() {
    isDragging = false;
    selectedPoint = null;
    // Reset snapping and free-drag state.
    dragSnapAxis = null;
    dragStartWorld = null;
    dragStartScreenPos = null;
    updateCursor();
}

function RGBtoHSL(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s, l: l };
}

function RGBtoLAB(r, g, b) {
    return {
        l: (r + g + b) / 3 / 255 * 100,
        a: (r - g) / 255 * 127,
        b: (b - g) / 255 * 127
    };
}

// Modified getCurrentViewport to use our new layout.
function getCurrentViewport() {
    let nonPrimaryWidth = height / 2;
    let primaryWidth = width - nonPrimaryWidth;
    if (mouseX < primaryWidth) {
        return { x: 0, y: 0, w: primaryWidth, h: height, space: currentMasterSpace };
    } else {
        let nonPrimarySpaces = ['RGB', 'HSL', 'LAB'].filter(space => space !== currentMasterSpace);
        if (mouseY < height / 2) {
            return { x: primaryWidth, y: 0, w: nonPrimaryWidth, h: height / 2, space: nonPrimarySpaces[0] };
        } else {
            return { x: primaryWidth, y: height / 2, w: nonPrimaryWidth, h: height / 2, space: nonPrimarySpaces[1] };
        }
    }
}

/**
 * Converts a 3D point into 2D screen coordinates using perspective projection.
 */
function getScreenPosition(point, viewport, globalOffset = { x: 0, y: 0 }) {
    let x, y, z;
    if (viewport.space === 'RGB') {
        x = point.x - 127.5;
        y = point.y - 127.5;
        z = point.z - 127.5;
    } else if (viewport.space === 'HSL') {
        const radius = point.y * 1.5;
        const angle = (point.x / 360) * TWO_PI;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = point.z * 3 - 150;
    } else if (viewport.space === 'LAB') {
        x = point.y * 2;
        y = (point.x - 50) * 2;
        z = point.z * 2;
    }
    
    let pos = new p5.Vector(x, y, z);
    let rotation = cameraRotations[viewport.space];
    pos = rotatePoint(pos, rotation.x, -rotation.y);
    
    pos.z -= CAMERA_Z;
    
    if (pos.z > 0) {
        pos.z = -pos.z;
    }
    
    const effectiveFocal = (viewport.h / 2) / tan(PI / 16.5);
    let perspectiveScale = effectiveFocal / -pos.z;
    
    let projectedX = pos.x * perspectiveScale * SCENE_SCALE;
    let projectedY = pos.y * perspectiveScale * SCENE_SCALE;
    
    let screenX = projectedX + viewport.x + viewport.w / 2 + globalOffset.x;
    let screenY = projectedY + viewport.y + viewport.h / 2 + globalOffset.y;
    
    return { x: screenX, y: screenY, depth: pos.z };
}

/**
 * Rotates a point (a p5.Vector) first around the Y axis then around the X axis.
 */
function rotatePoint(point, angleX, angleY) {
    let sinY = Math.sin(angleY);
    let cosY = Math.cos(angleY);
    let x = point.x * cosY - point.z * sinY;
    let z = point.x * sinY + point.z * cosY;
    
    let sinX = Math.sin(angleX);
    let cosX = Math.cos(angleX);
    let y = point.y * cosX - z * sinX;
    z = point.y * sinX + z * cosX;
    
    return new p5.Vector(x, y, z);
}

function createRotationX(angle) {
    return new p5.Matrix([
        1, 0, 0, 0,
        0, cos(angle), -sin(angle), 0,
        0, sin(angle), cos(angle), 0,
        0, 0, 0, 1
    ]);
}

function createRotationY(angle) {
    return new p5.Matrix([
        cos(angle), 0, sin(angle), 0,
        0, 1, 0, 0,
        -sin(angle), 0, cos(angle), 0,
        0, 0, 0, 1
    ]);
}

function drawHSLCylinder(g) {
    g.push();
    g.noFill();
    g.stroke(100);
    
    const cylinderResolution = 32;
    const radius = 150;
    const heightCylinder = 300;
    
    g.strokeWeight(1);
    g.beginShape();
    for (let i = 0; i <= cylinderResolution; i++) {
        const angle = (i / cylinderResolution) * TWO_PI;
        const x = cos(angle) * radius;
        const z = sin(angle) * radius;
        const hue = (angle / TWO_PI) * 360;
        g.stroke(colorFromHSL(hue, 100, 0.5));
        g.vertex(x, 0, z);
    }
    g.endShape(CLOSE);

    g.beginShape(LINES);
    g.strokeWeight(3);
    const numSegments = 50;
    for (let i = 0; i < numSegments; i++) {
        const y1 = map(i, 0, numSegments, -heightCylinder / 2, heightCylinder / 2);
        const y2 = map(i + 1, 0, numSegments, -heightCylinder / 2, heightCylinder / 2);
        const l1 = map(i, 0, numSegments, 0, 100);
        const l2 = map(i + 1, 0, numSegments, 0, 100);
        
        g.stroke(colorFromHSL(0, 0, l1 / 100));
        g.vertex(0, y1, 0);
        g.stroke(colorFromHSL(0, 0, l2 / 100));
        g.vertex(0, y2, 0);
    }
    g.endShape();
    
    g.pop();
}

function drawLABSpace(g) {
    g.push();
    g.strokeWeight(1);
    
    const lRange = 100;
    const abRange = 128;
    const scaleFactor = 1;
    
    g.strokeWeight(3);
    g.beginShape(LINES);
    for (let i = 0; i < lRange; i++) {
        const t = i / lRange;
        const pos = map(i, 0, lRange, -lRange / 2, lRange / 2) * scaleFactor;
        g.stroke(t * 255);
        g.vertex(0, pos, 0);
        g.vertex(0, pos + scaleFactor, 0);
    }
    g.endShape();
  
    g.strokeWeight(1);
    g.beginShape(LINES);
    for (let i = -abRange; i < abRange; i++) {
        const pos = i * scaleFactor;
        const red = constrain(map(i, 0, abRange, 128, 255), 0, 255);
        const green = constrain(map(i, -abRange, 0, 255, 128), 0, 255);
        g.stroke(red, green, 128);
        g.vertex(pos, 0, 0);
        g.vertex(pos + scaleFactor, 0, 0);
    }
    g.endShape();
    
    g.beginShape(LINES);
    for (let i = -abRange; i < abRange; i++) {
        const pos = i * scaleFactor;
        const yellowComponent = constrain(map(i, -abRange, 0, 255, 128), 0, 255);
        const blue = constrain(map(i, 0, abRange, 128, 255), 0, 255);
        g.stroke(yellowComponent, yellowComponent, blue);
        g.vertex(0, 0, pos);
        g.vertex(0, 0, pos + scaleFactor);
    }
    g.endShape();
    
    g.pop();
}

function updateCursor() {
    // Only try to update the cursor if the canvas exists.
    if (!cnv || !cnv.elt) {
        return;
    }
    
    if (selectedPoint !== null) {
        cursor('grabbing');
    } else if (hoveredPoint !== null) {
        cursor('grab');
    } else {
        cursor('default');
    }
}

function mouseMoved() {
    // Don't change the axis if we're in the middle of a drag operation
    if (selectedPoint !== null) {
        return;
    }

    const viewport = getCurrentViewport();
    if (!viewport || mouseY < 0 || mouseY > height || mouseX < 0 || mouseX > width) {
        hoveredPoint = null;
        dragSnapAxis = null;
        return;
    }

    hoveredPoint = null;
    dragSnapAxis = null;
    const points = bezierPoints[currentMasterSpace];
    
    let hitThreshold = 40 * getUniformScaleFactor();
    // Check all control points
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const screenPos = getScreenPosition(point, viewport);
        const d = dist(mouseX - viewport.x, mouseY - viewport.y, screenPos.x, screenPos.y);
        if (d < hitThreshold) {
            hoveredPoint = index;
            
            // If we're hovering near a point in RGB space, determine potential snap axis
            if (currentMasterSpace === 'RGB') {
                let currentDrag = createVector(mouseX - viewport.x - screenPos.x, mouseY - viewport.y - screenPos.y);
                
                if (currentDrag.mag() > 0) {  // Only determine axis if mouse isn't exactly on point
                    let axes = [
                        { axis: 'x', offset: createVector(1, 0, 0) },
                        { axis: 'y', offset: createVector(0, 1, 0) },
                        { axis: 'z', offset: createVector(0, 0, 1) }
                    ];
                    
                    let bestAxis = null;
                    let bestDot = -Infinity;
                    
                    for (let candidate of axes) {
                        let testPoint = {
                            x: point.x + candidate.offset.x,
                            y: point.y + candidate.offset.y,
                            z: point.z + candidate.offset.z
                        };
                        let projected = getScreenPosition(testPoint, viewport);
                        let candidateScreen = createVector(projected.x - screenPos.x, projected.y - screenPos.y);
                        let candidateNorm = candidateScreen.copy().normalize();
                        let currentDragNorm = currentDrag.copy().normalize();
                        let dotVal = abs(candidateNorm.dot(currentDragNorm));
                        if (dotVal > bestDot) {
                            bestDot = dotVal;
                            bestAxis = candidate.axis;
                        }
                    }
                    dragSnapAxis = bestAxis;
                }
            }
            break;
        }
    }
    
    updateCursor();
}

function constrainPoint(point, space) {
    switch (space) {
        case 'RGB':
            point.x = constrain(point.x, 0, 255);
            point.y = constrain(point.y, 0, 255);
            point.z = constrain(point.z, 0, 255);
            break;
        case 'HSL':
            point.x = ((point.x % 360) + 360) % 360;
            point.y = constrain(point.y, 0, 100);
            point.z = constrain(point.z, 0, 100);
            break;
        case 'LAB':
            point.x = constrain(point.x, 0, 100);
            point.y = constrain(point.y, -128, 127);
            point.z = constrain(point.z, -128, 127);
            break;
    }
}

function drawDebugInfo() {
    if (!showDebugInfo) return;
    
    const viewport = getCurrentViewport();
    if (!viewport) return;
    
    if (bezierPoints && bezierPoints[currentMasterSpace]) {
        bezierPoints[currentMasterSpace].forEach((pt, index) => {
            if (index === 0 || index === 1) {
                const screenPos = getScreenPosition(pt, viewport);
                push();
                    noFill();
                    stroke(255, 0, 0, 100);
                    strokeWeight(1);
                    circle(screenPos.x, screenPos.y, 80);
                    stroke(255, 0, 0);
                    strokeWeight(2);
                    ellipse(screenPos.x, screenPos.y, 4, 4);
                pop();
            }
        });
    }
    
    // Debug visualization for free-drag active area (only for RGB control points)
    if (showDebugInfo && currentMasterSpace === 'RGB') {
        let nonPrimaryWidth = height / 2;
        let primaryWidth = width - nonPrimaryWidth;
        const viewportForMaster = { x: 0, y: 0, w: primaryWidth, h: height, space: currentMasterSpace };
        let freeDragRadius = 15 * getUniformScaleFactor(); // Active area radius (same as in mousePressed)
        bezierPoints.RGB.forEach((pt) => {
            let sp = getScreenPosition(pt, viewportForMaster);
            push();
                noFill();
                stroke(0, 255, 0, 200);
                strokeWeight(2);
                ellipse(sp.x, sp.y, freeDragRadius * 2, freeDragRadius * 2);
            pop();
        });
    }
    
    push();
        stroke(0, 255, 0);
        strokeWeight(2);
        ellipse(mouseX, mouseY, 4, 4);
    pop();
}

function drawRGBCube(g) {
    g.push();
    
    // Enable blending for transparency
    g.blendMode(g.BLEND);
    g.clear();
    
    // Make cube edges thinner and semi-transparent when dragging or when a control point is hovered.
    let interactive = (selectedPoint !== null && dragSnapAxis !== null) || (hoveredPoint !== null);
    g.strokeWeight(interactive ? 0.5 : 1);
    
    const size = 255;
    const offset = -127.5;
    
    // Use a semi-transparent alpha when interactive.
    let edgeAlpha = interactive ? 100 : 255;
    
    // Edges parallel to the X axis
    g.beginShape(g.LINES);
        g.stroke(0, 0, 0, edgeAlpha);
        g.vertex(offset, offset, offset);
        g.stroke(255, 0, 0, edgeAlpha);
        g.vertex(offset + size, offset, offset);
    
        g.stroke(0, 0, 255, edgeAlpha);
        g.vertex(offset, offset, offset + size);
        g.stroke(255, 0, 255, edgeAlpha);
        g.vertex(offset + size, offset, offset + size);
    
        g.stroke(0, 255, 0, edgeAlpha);
        g.vertex(offset, offset + size, offset);
        g.stroke(255, 255, 0, edgeAlpha);
        g.vertex(offset + size, offset + size, offset);
    
        g.stroke(0, 255, 255, edgeAlpha);
        g.vertex(offset, offset + size, offset + size);
        g.stroke(255, 255, 255, edgeAlpha);
        g.vertex(offset + size, offset + size, offset + size);
    g.endShape();
    
    // Edges parallel to the Y axis
    g.beginShape(g.LINES);
        g.stroke(0, 0, 0, edgeAlpha);
        g.vertex(offset, offset, offset);
        g.stroke(0, 255, 0, edgeAlpha);
        g.vertex(offset, offset + size, offset);
    
        g.stroke(255, 0, 0, edgeAlpha);
        g.vertex(offset + size, offset, offset);
        g.stroke(255, 255, 0, edgeAlpha);
        g.vertex(offset + size, offset + size, offset);
    
        g.stroke(0, 0, 255, edgeAlpha);
        g.vertex(offset, offset, offset + size);
        g.stroke(0, 255, 255, edgeAlpha);
        g.vertex(offset, offset + size, offset + size);
    
        g.stroke(255, 0, 255, edgeAlpha);
        g.vertex(offset + size, offset, offset + size);
        g.stroke(255, 255, 255, edgeAlpha);
        g.vertex(offset + size, offset + size, offset + size);
    g.endShape();
    
    // Edges parallel to the Z axis
    g.beginShape(g.LINES);
        g.stroke(0, 0, 0, edgeAlpha);
        g.vertex(offset, offset, offset);
        g.stroke(0, 0, 255, edgeAlpha);
        g.vertex(offset, offset, offset + size);
    
        g.stroke(255, 0, 0, edgeAlpha);
        g.vertex(offset + size, offset, offset);
        g.stroke(255, 0, 255, edgeAlpha);
        g.vertex(offset + size, offset, offset + size);
    
        g.stroke(0, 255, 0, edgeAlpha);
        g.vertex(offset, offset + size, offset);
        g.stroke(0, 255, 255, edgeAlpha);
        g.vertex(offset, offset + size, offset + size);
    
        g.stroke(255, 255, 0, edgeAlpha);
        g.vertex(offset + size, offset + size, offset);
        g.stroke(255, 255, 255, edgeAlpha);
        g.vertex(offset + size, offset + size, offset + size);
    g.endShape();
    g.pop();
}

function keyPressed() {
    if (key === 'd' || key === 'D') {
        showDebugInfo = !showDebugInfo;
    }
}

function windowResized() {
    // Set the main canvas to the full window dimensions.
    resizeCanvas(windowWidth, windowHeight);
    cnv.position(0, 0);
    updateBufferSizes();
}

function drawAxisLinesRGB_FreeHover(g, point) {
    // Get the current camera rotation from the RGB space.
    let rotation = cameraRotations['RGB'];
    // Compute the rotated world-basis vectors.
    let rx = rotatePoint(new p5.Vector(1, 0, 0), rotation.x, rotation.y);
    let ry = rotatePoint(new p5.Vector(0, 1, 0), rotation.x, rotation.y);
    let rz = rotatePoint(new p5.Vector(0, 0, 1), rotation.x, rotation.y);
    // In our setup the camera views down the negative Z.
    const viewDir = new p5.Vector(0, 0, -1);
    
    // Determine how aligned each world axis is with the camera view.
    let alignX = abs(rx.dot(viewDir));
    let alignY = abs(ry.dot(viewDir));
    let alignZ = abs(rz.dot(viewDir));
    
    // The axis most aligned with the viewing direction is fixed.
    let fixedAxis = 'x';
    if (alignY > alignX && alignY > alignZ) {
        fixedAxis = 'y';
    } else if (alignZ > alignX && alignZ > alignY) {
        fixedAxis = 'z';
    }
    // The free axes (the ones that will move) are the remaining two.
    let freeAxes = ['x', 'y', 'z'].filter(axis => axis !== fixedAxis);
    
    let segments = 20;
    // For clarity in free hover, we use a fixed alpha and weight.
    let axisAlpha = 150;
    let lowerWeight = 4.0;
    let upperWeight = 1.0;
    
    freeAxes.forEach(axis => {
        if (axis === 'x') {
            let xStart = -point.x;
            let xEnd = 255 - point.x;
            // Lower segment from xStart to the sphere center (0)
            drawGradientLine(
                g,
                createVector(xStart, 0, 0),
                createVector(0, 0, 0),
                color(0, point.y, point.z, axisAlpha),
                color(point.x, point.y, point.z, axisAlpha),
                segments,
                lowerWeight
            );
            // Upper segment from center to xEnd.
            drawGradientLine(
                g,
                createVector(0, 0, 0),
                createVector(xEnd, 0, 0),
                color(point.x, point.y, point.z, axisAlpha),
                color(255, point.y, point.z, axisAlpha),
                segments,
                upperWeight
            );
        }
        if (axis === 'y') {
            let yStart = -point.y;
            let yEnd = 255 - point.y;
            drawGradientLine(
                g,
                createVector(0, yStart, 0),
                createVector(0, 0, 0),
                color(point.x, 0, point.z, axisAlpha),
                color(point.x, point.y, point.z, axisAlpha),
                segments,
                lowerWeight
            );
            drawGradientLine(
                g,
                createVector(0, 0, 0),
                createVector(0, yEnd, 0),
                color(point.x, point.y, point.z, axisAlpha),
                color(point.x, 255, point.z, axisAlpha),
                segments,
                upperWeight
            );
        }
        if (axis === 'z') {
            let zStart = -point.z;
            let zEnd = 255 - point.z;
            drawGradientLine(
                g,
                createVector(0, 0, zStart),
                createVector(0, 0, 0),
                color(point.x, point.y, 0, axisAlpha),
                color(point.x, point.y, point.z, axisAlpha),
                segments,
                lowerWeight
            );
            drawGradientLine(
                g,
                createVector(0, 0, 0),
                createVector(0, 0, zEnd),
                color(point.x, point.y, point.z, axisAlpha),
                color(point.x, point.y, 255, axisAlpha),
                segments,
                upperWeight
            );
        }
    });
}
