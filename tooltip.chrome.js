const body = document.querySelector('body');
const port = chrome.runtime.connect({ name: "dimensions" });
const changeDelay = 300;
let changeTimeout;
let paused = true;
let connectionClosed = false;
const lineColor = getLineColor();
const colorThreshold = [0.2, 0.5, 0.2];
const overlay = document.createElement('div');
overlay.className = 'fn-noCursor';
const canvas = document.createElement('canvas');
const image = new Image();

let imgData;
let data;
let width;
let height;

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
  const dimensions = body.querySelector('.fn-dimensions');
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

  const distances = measureDistances(data, imgData, width, height, { x: inputX, y: inputY });
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

  const newDimensions = document.createElement('div');
  newDimensions.className = 'fn-dimensions';
  newDimensions.style.left = dimensions.x + "px";
  newDimensions.style.top = dimensions.y + "px";

  if (Math.abs(dimensions.backgroundColor[0] - lineColor[0]) <= colorThreshold[0] &&
    Math.abs(dimensions.backgroundColor[1] - lineColor[1]) <= colorThreshold[1] &&
    Math.abs(dimensions.backgroundColor[2] - lineColor[2]) <= colorThreshold[2])
    newDimensions.className += ' altColor';

  const measureWidth = dimensions.left + dimensions.right;
  const measureHeight = dimensions.top + dimensions.bottom;

  const xAxis = document.createElement('div');
  xAxis.className = 'x fn-axis';
  xAxis.style.left = -dimensions.left + "px";
  xAxis.style.width = measureWidth + "px";

  const yAxis = document.createElement('div');
  yAxis.className = 'y fn-axis';
  yAxis.style.top = -dimensions.top + "px";
  yAxis.style.height = measureHeight + "px";

  const tooltip = document.createElement('div');
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
  const axis = document.createElement('div');
  axis.className = 'fn-axis';

  body.appendChild(axis);

  const style = getComputedStyle(axis);
  const rgbString = style.backgroundColor;
  const colorsOnly = rgbString.substring(rgbString.indexOf('(') + 1, rgbString.lastIndexOf(')')).split(/,\s*/);

  body.removeChild(axis);

  return rgbToHsl(colorsOnly[0], colorsOnly[1], colorsOnly[2]);
}
