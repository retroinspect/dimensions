function getDimensions(values) {
    let min = Infinity;
    let max = 0;

    for (let i = 0, l = values.length; i < l; i++) {
        if (values[i] < min)
            min = values[i];
        if (values[i] > max)
            max = values[i];
    }

    return {
        min: min,
        center: min + Math.floor((max - min) / 2),
        max: max,
        length: max - min
    };
}


function getColorAt(x, y, imgData, width, height) {
    if (!inBoundaries(x, y, width, height))
        return -1;

    const i = y * width * 4 + x * 4;

    return rgbToHsl(imgData[i], imgData[i + 1], imgData[i + 1]);
}

function getLightnessAt(data, x, y, width, height) {
    const result = inBoundaries(x, y, width, height) ? data[y * width + x] : -1;
    return result;
}

function setLightnessAt(data, x, y, value, width, height) {
    return inBoundaries(x, y, width, height) ? data[y * width + x] = value : -1;
}

//
// inBoundaries
// ============
//  
// checks if x and y are in the canvas boundaries
//
function inBoundaries(x, y, width, height) {
    if (x >= 0 && x < width && y >= 0 && y < height)
        return true;
    else
        return false;
}


//
// Grayscale
// ---------
//  
// reduces the input image data to an array of gray shades.
//

function grayscale(imgData) {
    const gray = new Int16Array(imgData.length / 4);
    for (let i = 0, n = 0, l = imgData.length; i < l; i += 4, n++) {
        const r = imgData[i],
            g = imgData[i + 1],
            b = imgData[i + 2];

        // weighted grayscale algorithm
        gray[n] = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
    }

    return gray;
}

/**
* Converts an RGB color value to HSL. Conversion formula
* adapted from http://en.wikipedia.org/wiki/HSL_color_space.
* Assumes r, g, and b are contained in the set [0, 255] and
* returns h, s, and l in the set [0, 1].
*
* @param   Number  r       The red color value
* @param   Number  g       The green color value
* @param   Number  b       The blue color value
* @return  Array           The HSL representation
*/
function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
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

    return [h, s, l];
}


//
// measureDistances
// ================
//  
// measures the distances to the next boundary
// around pageX and pageY.
//
function measureDistances(data, imgData, width, height, input) {
    let distances = {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    };
    const directions = {
        top: { x: 0, y: -1 },
        right: { x: 1, y: 0 },
        bottom: { x: 0, y: 1 },
        left: { x: -1, y: 0 }
    };
    let area = 0;
    const startLightness = getLightnessAt(data, input.x, input.y, width, height);
    let lastLightness;

    for (const direction in distances) {
        const vector = directions[direction];
        let boundaryFound = false;
        let sx = input.x;
        let sy = input.y;
        let currentLightness;

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
        let similarColorStreakThreshold = 8;

        for (const direction in distances) {
            const vector = directions[direction];
            let boundaryFound = false;
            let sx = input.x;
            let sy = input.y;
            let currentLightness;
            let similarColorStreak = 0;

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

