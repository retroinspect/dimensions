var body = document.querySelector('body');
var port = chrome.runtime.connect({ name: "dimensions" });
var changeDelay = 300;
var changeTimeout;
var paused = true;
var connectionClosed = false;
var lineColor = getLineColor();
const colorThreshold = [0.2, 0.5, 0.2];
var overlay = document.createElement('div');
overlay.className = 'fn-noCursor';
var canvas = document.createElement('canvas');
var image = new Image();

var imgData;
var data;
var width;
var height;

const dimensionsThreshold = 6;

port.onMessage.addListener(function (event) {
  if (connectionClosed)
    return;

  switch (event.type) {
    case 'destroy':
      destroy();
      break;
    case 'screen data':
      image.src = event.data.imgDataUrl;
      image.onload = () => {
        const ctx = canvas.getContext('2d');
        width = event.data.width;
        height = event.data.height;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        imgData = ctx.getImageData(0, 0, width, height).data;
        data = grayscale(imgData);
        resume();
      };
      break;
  }
});

init();
onResizeWindow();

function init() {
  window.addEventListener('mousemove', onInputMove);
  window.addEventListener('touchmove', onInputMove);
  window.addEventListener('scroll', onVisibleAreaChange);
  window.addEventListener('resize', onResizeWindow);
  window.addEventListener('keyup', onKeyRelease);

  disableCursor();
  requestNewScreenshot();
}


function onResizeWindow() {
  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
  onVisibleAreaChange();
}



function destroy() {
  connectionClosed = true;
  window.removeEventListener('mousemove', onInputMove);
  window.removeEventListener('touchmove', onInputMove);
  window.removeEventListener('scroll', onVisibleAreaChange);

  removeDimensions();
  enableCursor();
}

function removeDimensions() {
  var dimensions = body.querySelector('.fn-dimensions');
  if (dimensions)
    body.removeChild(dimensions);
}

function onVisibleAreaChange() {
  if (!paused)
    pause();
  else
    return;

  if (changeTimeout)
    clearTimeout(changeTimeout);

  changeTimeout = setTimeout(requestNewScreenshot, changeDelay);
}

function requestNewScreenshot() {
  port.postMessage({ type: 'take screenshot' });
}

function pause() {
  paused = true;
  removeDimensions();
  enableCursor();
}

function resume() {
  paused = false;
  disableCursor();
}

function disableCursor() {
  body.appendChild(overlay);
}

function enableCursor() {
  body.removeChild(overlay);
}

function onKeyRelease(event) {
  switch (event.code) {
    case 'Escape':
      port.postMessage({ type: 'close_overlay' });
      break;
  }
}

//
// onInputMove
// ===========
//  
// detects the current pointer position and requests the dimensions at that position
//

function onInputMove(event) {
  let inputX, inputY;

  if (event.touches) {
    inputX = event.touches[0].clientX;
    inputY = event.touches[0].clientY;
  } else {
    inputX = event.clientX;
    inputY = event.clientY;
  }

  const distances = measureDistances({ x: inputX, y: inputY });
  showDimensions(distances);
}


//
// showDimensions
// ==============
//  
// renders the visualisation of the measured dimensions
//

function showDimensions(dimensions) {
  if (paused)
    return;

  removeDimensions();

  if (!dimensions)
    return;

  var newDimensions = document.createElement('div');
  newDimensions.className = 'fn-dimensions';
  newDimensions.style.left = dimensions.x + "px";
  newDimensions.style.top = dimensions.y + "px";

  if (Math.abs(dimensions.backgroundColor[0] - lineColor[0]) <= colorThreshold[0] &&
    Math.abs(dimensions.backgroundColor[1] - lineColor[1]) <= colorThreshold[1] &&
    Math.abs(dimensions.backgroundColor[2] - lineColor[2]) <= colorThreshold[2])
    newDimensions.className += ' altColor';

  var measureWidth = dimensions.left + dimensions.right;
  var measureHeight = dimensions.top + dimensions.bottom;

  var xAxis = document.createElement('div');
  xAxis.className = 'x fn-axis';
  xAxis.style.left = -dimensions.left + "px";
  xAxis.style.width = measureWidth + "px";

  var yAxis = document.createElement('div');
  yAxis.className = 'y fn-axis';
  yAxis.style.top = -dimensions.top + "px";
  yAxis.style.height = measureHeight + "px";

  var tooltip = document.createElement('div');
  tooltip.className = 'fn-tooltip';

  // add +1 on both axis because of the pixel below the mouse pointer
  tooltip.textContent = (measureWidth + 1) + " x " + (measureHeight + 1) + " px";

  if (dimensions.y < 26)
    tooltip.classList.add('bottom');

  if (dimensions.x > window.innerWidth - 110)
    tooltip.classList.add('left');

  newDimensions.appendChild(xAxis);
  newDimensions.appendChild(yAxis);
  newDimensions.appendChild(tooltip);

  body.appendChild(newDimensions);
}

function getLineColor() {
  var axis = document.createElement('div');
  axis.className = 'fn-axis';

  body.appendChild(axis);

  var style = getComputedStyle(axis);
  var rgbString = style.backgroundColor;
  var colorsOnly = rgbString.substring(rgbString.indexOf('(') + 1, rgbString.lastIndexOf(')')).split(/,\s*/);

  body.removeChild(axis);

  return rgbToHsl(colorsOnly[0], colorsOnly[1], colorsOnly[2]);
}



//
// measureDistances
// ================
//  
// measures the distances to the next boundary
// around pageX and pageY.
//

function measureDistances(input) {
  var distances = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  var directions = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
  };
  var area = 0;
  var startLightness = getLightnessAt(data, input.x, input.y, width, height);
  var lastLightness;

  for (var direction in distances) {
    var vector = directions[direction];
    var boundaryFound = false;
    var sx = input.x;
    var sy = input.y;
    var currentLightness;

    // reset lightness to start lightness
    lastLightness = startLightness;

    while (!boundaryFound) {
      sx += vector.x;
      sy += vector.y;
      currentLightness = getLightnessAt(data, sx, sy, width, height);
      if (currentLightness > -1 && Math.abs(currentLightness - lastLightness) < dimensionsThreshold) {
        distances[direction]++;
        lastLightness = currentLightness;
      } else {
        boundaryFound = true;
      }
    }

    area += distances[direction];


  }

  if (area <= 6) {
    distances = { top: 0, right: 0, bottom: 0, left: 0 };
    var similarColorStreakThreshold = 8;

    for (var direction in distances) {
      var vector = directions[direction];
      var boundaryFound = false;
      var sx = input.x;
      var sy = input.y;
      var currentLightness;
      var similarColorStreak = 0;

      lastLightness = startLightness;

      while (!boundaryFound) {
        sx += vector.x;
        sy += vector.y;
        currentLightness = getLightnessAt(data, sx, sy, width, height);

        if (currentLightness > -1) {
          distances[direction]++;

          if (Math.abs(currentLightness - lastLightness) < dimensionsThreshold) {
            similarColorStreak++;
            if (similarColorStreak === similarColorStreakThreshold) {
              distances[direction] -= (similarColorStreakThreshold + 1);
              boundaryFound = true;
            }
          } else {
            lastLightness = currentLightness;
            similarColorStreak = 0;
          }
        } else {
          boundaryFound = true;
        }
      }
    }
  }

  distances.x = input.x;
  distances.y = input.y;
  distances.backgroundColor = getColorAt(input.x, input.y, imgData, width, height);

  return distances;
}

