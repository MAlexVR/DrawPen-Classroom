import {
  getPerfectPath2D,
  getLazyPoints,
  distanceBetweenPoints,
  calcPointsArrow,
  calcSegmentsFlatArrow,
  buildArrowArcSegments,
  isSmallArrowFigure,
} from '../../utils/general.js';
import {
  widthList,
  rainbowScaleFactor,
  dotTextMargin,
  dotRadius,
  dotStrokeWidth,
  dotHoverRadius,
  dotBorderColor,
  dotHoverColor,
  erasedFigureColor,
  eraserTailColor,
  highlighterAlpha,
  eraserAlpha,
  dashedLineDefaultDashSize,
  dashedLineDefaultSpacing,
} from '../../constants.js'

const hslColor = (degree) => {
  return `hsl(${degree % 360}, 70%, 60%)`
}

function fadeAlpha(opacity) {
  return Math.round(opacity * 255).toString(16).padStart(2, '0');
}

const drawDot = (ctx, point, isHovered) => {
  const [x, y] = point;

  if (isHovered) {
    ctx.beginPath();
    ctx.arc(x, y, dotHoverRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = dotHoverColor;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(x, y, dotRadius, 0, Math.PI * 2, true);
  ctx.fillStyle = '#FFF';
  ctx.fill();
  ctx.lineWidth = dotStrokeWidth;
  ctx.strokeStyle = dotBorderColor;
  ctx.stroke();
}

const createGradient = (ctx, pointA, pointB, rainbowColorDeg, updateRainbowColorDeg) => {
  const [distance, hslStops] = hslTextGradientStops(pointA, pointB, rainbowColorDeg)

  if (hslStops.length === 1) {
    return hslStops[0]
  }

  const gradient = ctx.createLinearGradient(...pointA, ...pointB);

  hslStops.forEach((color, index) => {
    gradient.addColorStop(index / (hslStops.length - 1), color)
  })

  updateRainbowColorDeg(rainbowColorDeg + distance)
  return gradient
}

export const hslTextGradientStops = (pointA, pointB, colorDeg) => {
  const distance = distanceBetweenPoints(pointA, pointB) * rainbowScaleFactor

  const amountOfColorChanges = Math.round(distance)

  const hslStops = []
  for (let i = 0; i <= amountOfColorChanges; i++) {
    let color = hslColor(colorDeg + i)

    hslStops.push(color)
  }

  if (amountOfColorChanges === 0) {
    hslStops.push(hslColor(colorDeg))
  }

  return [distance, hslStops];
}

const activeColorAndWidth = (figure, colorList) => {
  const { colorIndex } = figure;
  const width = 2;

  if (colorList[colorIndex].isLightColor) {
    return ['#6CC3E2', width]
  }

  return ['#FFF', width]
}

const detectColorAndWidth = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA, pointB], colorIndex, widthIndex, rainbowColorDeg, erased } = figure

  let color = colorList[colorIndex].color
  const width = widthList[widthIndex].figure_size

  if (colorList[colorIndex].isRainbow) {
    color = createGradient(ctx, pointA, pointB, rainbowColorDeg, updateRainbowColorDeg)
  }

  if (erased) {
    color = erasedFigureColor + fadeAlpha(eraserAlpha);
  }

  return [color, width]
}

const detectColorAndFontSize = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA], colorIndex, widthIndex, rainbowColorDeg, width, height, erased } = figure;

  let color = colorList[colorIndex].color
  const fontSize = widthList[widthIndex].font_size
  let font_y_offset_compensation = widthList[widthIndex].font_y_offset_compensation

  const dpr = (window.devicePixelRatio || 1);
  if (dpr > 1) {
    font_y_offset_compensation = widthList[widthIndex].font_y_offset_compensation_retina
  }

  if (colorList[colorIndex].isRainbow) {
    const pointB = [pointA[0], pointA[1] + height] // Vertical Gradient

    color = createGradient(ctx, pointA, pointB, rainbowColorDeg, updateRainbowColorDeg)
  }

  if (erased) {
    color = erasedFigureColor + fadeAlpha(eraserAlpha);
  }

  return [color, fontSize, font_y_offset_compensation]
}

export const getCursorColor = (colorList, colorIndex, rainbowColorDeg) => {
  const colorInfo = colorList[colorIndex]

  if (colorInfo.isRainbow) {
    return hslColor(rainbowColorDeg)
  }

  return colorInfo.color
}

export const drawPen = (ctx, figure, colorList, fadeOpacity = 1) => {
  const { points, colorIndex, widthIndex } = figure;

  const colorInfo = colorList[colorIndex]
  const widthInfo = widthList[widthIndex]

  let penColor = colorInfo.color

  if (figure.erased) {
    penColor = erasedFigureColor + fadeAlpha(Math.min(eraserAlpha, fadeOpacity));
  } else if (fadeOpacity < 1) {
    penColor = colorInfo.color + fadeAlpha(fadeOpacity);
  }

  const path2DData = getPerfectPath2D(points, { size: figure.brushSize ?? widthInfo.pen_width });

  ctx.fillStyle = penColor;
  ctx.fill(path2DData);
}

export const drawRainbowPen = (ctx, offscreenCanvas, figure, updateRainbowColorDeg, fadeOpacity = 1) => {
  const { widthIndex } = figure;

  const offCtx = offscreenCanvas.getContext('2d');
  offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  const widthInfo = widthList[widthIndex]

  drawLazyRainbowLine(offCtx, figure, updateRainbowColorDeg, figure.brushSize ?? widthInfo.rainbow_pen_width)

  let alpha = fadeOpacity;

  if (figure.erased) {
    alpha = Math.min(eraserAlpha, fadeOpacity);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.resetTransform();
  ctx.drawImage(offscreenCanvas, 0, 0);
  ctx.restore();
}

const drawLazyRainbowLine = (ctx, figure, updateRainbowColorDeg, width) => {
  const { points, rainbowColorDeg, erased } = figure;

  const lazyPoints = getLazyPoints(points, { size: width })
  let colorDeg = rainbowColorDeg

  lazyPoints.forEach((point, index) => {
    if (index === 0) return;

    const pointA = lazyPoints[index-1]
    const pointB = point

    const distance = distanceBetweenPoints(pointA, pointB) * rainbowScaleFactor

    let color
    if (erased) {
      color = erasedFigureColor
    } else  {
      color = hslColor(colorDeg + distance / 2);
    }

    ctx.beginPath()
    ctx.lineWidth = width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(pointA[0], pointA[1])
    ctx.lineTo(pointB[0], pointB[1]);

    ctx.strokeStyle = color
    ctx.stroke()

    colorDeg += distance
  })

  updateRainbowColorDeg(colorDeg)
}

export const drawHighlighter = (ctx, figure, colorList) => {
  const { points, colorIndex, widthIndex } = figure;

  const colorInfo = colorList[colorIndex]
  const widthInfo = widthList[widthIndex]

  let highlighterColor = colorInfo.color + fadeAlpha(highlighterAlpha);
  if (figure.erased) {
    highlighterColor = erasedFigureColor + fadeAlpha(highlighterAlpha);
  }

  const path2DData = getPerfectPath2D(points, {
    size: widthInfo.highlighter_width,
    simulatePressure: false,
    thinning: 0.0
  });

  ctx.fillStyle = highlighterColor;
  ctx.fill(path2DData);
}

export const drawRainbowHighlighter = (ctx, offscreenCanvas, figure, updateRainbowColorDeg) => {
  const { widthIndex } = figure;

  const offCtx = offscreenCanvas.getContext('2d');
  offCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  const widthInfo = widthList[widthIndex]

  drawLazyRainbowLine(offCtx, figure, updateRainbowColorDeg, widthInfo.highlighter_width);

  let alpha = highlighterAlpha;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.resetTransform();
  ctx.drawImage(offscreenCanvas, 0, 0);
  ctx.restore();
}

export const drawArrow = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points, widthIndex } = figure;

  const isSmallArrow = isSmallArrowFigure(points, widthIndex);
  const figurePoints = calcPointsArrow(points, widthIndex);
  const arcSegments = buildArrowArcSegments(figurePoints, widthIndex);

  const [color] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)
  const shadowColor = '#222';
  const shadowBlur = 2;
  const shadowOffsetX = 1;
  const shadowOffsetY = 2;

  ctx.fillStyle = color;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = shadowOffsetX;
  ctx.shadowOffsetY = shadowOffsetY;

  ctx.beginPath();
  ctx.moveTo(...figurePoints[0]);

  arcSegments.forEach(({ entryPoint, cornerPoint, exitPoint, arcRadius }) => {
    if (isSmallArrow) {
      ctx.lineTo(...cornerPoint);
      return;
    }

    ctx.lineTo(...entryPoint);
    ctx.arcTo(cornerPoint[0], cornerPoint[1], exitPoint[0], exitPoint[1], arcRadius);
  });

  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent'; // Reset shadows
}

export const drawArrowActive = (ctx, figure, hoveredDot) => {
  drawDotsForFigure(ctx, figure, hoveredDot)
}

export const drawFlatArrow = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)
  const segments = calcSegmentsFlatArrow(figure.points, figure.widthIndex)

  segments.forEach(([pointA, pointB]) => {
    drawLineSkeleton(ctx, pointA, pointB, color, width)
  })
}

export const drawFlatArrowActive = (ctx, figure, hoveredDot) => {
  drawDotsForFigure(ctx, figure, hoveredDot)
}

export const drawLine = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA, pointB] } = figure
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)

  drawLineSkeleton(ctx, pointA, pointB, color, width)
}

export const drawLineActive = (ctx, figure, hoveredDot, colorList) => {
  const [pointA, pointB] = figure.points
  const [color, width] = activeColorAndWidth(figure, colorList)

  drawLineSkeleton(ctx, pointA, pointB, color, width)

  drawDotsForFigure(ctx, figure, hoveredDot)
}

export const drawDashedLine = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA, pointB] } = figure
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)

  drawLineSkeleton(ctx, pointA, pointB, color, width, true, figure.dashSize, figure.dashSpacing)
}

export const drawDashedLineActive = (ctx, figure, hoveredDot, colorList) => {
  const [pointA, pointB] = figure.points
  const [color, width] = activeColorAndWidth(figure, colorList)

  drawLineSkeleton(ctx, pointA, pointB, color, width, true, figure.dashSize, figure.dashSpacing)

  drawDotsForFigure(ctx, figure, hoveredDot)
}

const drawAxisArrowHead = (ctx, tip, direction, color, size) => {
  const [tipX, tipY] = tip
  const [directionX, directionY] = direction
  const baseX = tipX - directionX * size
  const baseY = tipY - directionY * size
  const perpendicularX = -directionY * size * 0.55
  const perpendicularY = directionX * size * 0.55

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(baseX + perpendicularX, baseY + perpendicularY)
  ctx.lineTo(baseX - perpendicularX, baseY - perpendicularY)
  ctx.closePath()
  ctx.fill()
}

const drawNumberLineSkeleton = (ctx, figure, color, width) => {
  const { points: [pointA, pointB], minimum = -5, maximum = 5, widthIndex } = figure
  const deltaX = pointB[0] - pointA[0]
  const deltaY = pointB[1] - pointA[1]
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY)
  const range = maximum - minimum

  if (range < 1) return

  const tickSize = 6 + widthIndex
  const arrowSize = 8 + widthIndex
  const fontSize = 15 + widthIndex
  let start
  let end
  let length

  if (horizontal) {
    const y = (pointA[1] + pointB[1]) / 2
    start = [Math.min(pointA[0], pointB[0]), y]
    end = [Math.max(pointA[0], pointB[0]), y]
    length = end[0] - start[0]
  } else {
    const x = (pointA[0] + pointB[0]) / 2
    start = [x, Math.max(pointA[1], pointB[1])]
    end = [x, Math.min(pointA[1], pointB[1])]
    length = start[1] - end[1]
  }

  if (length < 1) return

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(...start)
  ctx.lineTo(...end)
  ctx.stroke()

  if (horizontal) {
    drawAxisArrowHead(ctx, start, [-1, 0], color, arrowSize)
    drawAxisArrowHead(ctx, end, [1, 0], color, arrowSize)
  } else {
    drawAxisArrowHead(ctx, start, [0, 1], color, arrowSize)
    drawAxisArrowHead(ctx, end, [0, -1], color, arrowSize)
  }

  const intervalLength = length / range
  const labelEvery = Math.max(1, Math.ceil(34 / intervalLength))
  ctx.font = `500 ${fontSize}px Inter`

  for (let value = minimum; value <= maximum; value += 1) {
    const ratio = (value - minimum) / range
    let x
    let y

    if (horizontal) {
      x = start[0] + length * ratio
      y = start[1]
      ctx.beginPath()
      ctx.moveTo(x, y - tickSize)
      ctx.lineTo(x, y + tickSize)
      ctx.stroke()
    } else {
      x = start[0]
      y = start[1] - length * ratio
      ctx.beginPath()
      ctx.moveTo(x - tickSize, y)
      ctx.lineTo(x + tickSize, y)
      ctx.stroke()
    }

    const isRequiredLabel = value === minimum || value === maximum || value === 0
    if (!isRequiredLabel && (value - minimum) % labelEvery !== 0) continue

    if (horizontal) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(String(value), x, y + tickSize + 9)
    } else {
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(value), x - tickSize - 10, y)
    }
  }

  ctx.restore()
}

export const drawNumberLine = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)
  drawNumberLineSkeleton(ctx, figure, color, width)
}

export const drawNumberLineActive = (ctx, figure, hoveredDot) => {
  drawDotsForFigure(ctx, figure, hoveredDot)
}

const drawLineSkeleton = (ctx, pointA, pointB, color, width, dashed = false, dashSize, dashSpacing) => {
  const [startX, startY] = pointA;
  const [endX, endY] = pointB;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  if (dashed) {
    // Ratios relative to stroke width. A near-zero dash length collapses to
    // a small round dot (the round line cap fills it out to a circle whose
    // diameter equals the stroke width) instead of an elongated pill;
    // raising it stretches that into a longer dash. Older saved figures
    // predate these per-figure fields, so fall back to the old look.
    const resolvedDashSize = Number.isFinite(dashSize) ? dashSize : dashedLineDefaultDashSize;
    const resolvedSpacing = Number.isFinite(dashSpacing) ? dashSpacing : dashedLineDefaultSpacing;

    ctx.setLineDash([width * resolvedDashSize, width * resolvedSpacing]);
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  if (dashed) {
    // The dash pattern persists on the shared canvas context otherwise,
    // silently turning later solid strokes dashed too.
    ctx.setLineDash([]);
  }
};

export const drawOval = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA, pointB] } = figure
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)

  drawOvalSkeleton(ctx, pointA, pointB, color, width)
}

export const drawOvalActive = (ctx, figure, hoveredDot, colorList) => {
  const [pointA, pointB] = figure.points
  const [color, width] = activeColorAndWidth(figure, colorList)

  drawOvalSkeleton(ctx, pointA, pointB, color, width)

  drawDotsForFigure(ctx, figure, hoveredDot)
}

const drawOvalSkeleton = (ctx, pointA, pointB, color, width) => {
  const [startX, startY] = pointA;
  const [endX, endY] = pointB;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';

  let radiusX = Math.abs(endX - startX) / 2;
  let radiusY = Math.abs(endY - startY) / 2;
  let centerX = Math.min(startX, endX) + radiusX;
  let centerY = Math.min(startY, endY) + radiusY;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export const drawRectangle = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA, pointB] } = figure
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)

  drawRectangleSkeleton(ctx, pointA, pointB, color, width)
}

export const drawRectangleActive = (ctx, figure, hoveredDot, colorList) => {
  const [pointA, pointB] = figure.points
  const [color, width] = activeColorAndWidth(figure, colorList)

  drawRectangleSkeleton(ctx, pointA, pointB, color, width)
  drawDotsForFigure(ctx, figure, hoveredDot)
}

const getTrianglePoints = (pointA, pointB) => {
  const minX = Math.min(pointA[0], pointB[0])
  const maxX = Math.max(pointA[0], pointB[0])
  const minY = Math.min(pointA[1], pointB[1])
  const maxY = Math.max(pointA[1], pointB[1])

  return [
    [(minX + maxX) / 2, minY],
    [maxX, maxY],
    [minX, maxY],
  ]
}

const drawTriangleSkeleton = (ctx, pointA, pointB, color, width) => {
  const [top, bottomRight, bottomLeft] = getTrianglePoints(pointA, pointB)

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(...top)
  ctx.lineTo(...bottomRight)
  ctx.lineTo(...bottomLeft)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

export const drawTriangle = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const { points: [pointA, pointB] } = figure
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)

  drawTriangleSkeleton(ctx, pointA, pointB, color, width)
}

export const drawTriangleActive = (ctx, figure, hoveredDot, colorList) => {
  const { points: [pointA, pointB] } = figure
  const [color, width] = activeColorAndWidth(figure, colorList)

  drawTriangleSkeleton(ctx, pointA, pointB, color, width)
  drawDotsForFigure(ctx, figure, hoveredDot)
}

export const drawTable = (ctx, figure, updateRainbowColorDeg, colorList) => {
  const [color, width] = detectColorAndWidth(ctx, figure, updateRainbowColorDeg, colorList)

  drawTableSkeleton(ctx, figure, color, width)
}

export const drawTableActive = (ctx, figure, hoveredDot, colorList) => {
  const [color, width] = activeColorAndWidth(figure, colorList)

  drawTableSkeleton(ctx, figure, color, width)
  drawDotsForFigure(ctx, figure, hoveredDot)
}

const drawTableSkeleton = (ctx, figure, color, width) => {
  const { points: [pointA, pointB], rows = 3, columns = 3 } = figure
  const [startX, startY] = pointA
  const [endX, endY] = pointB
  const minX = Math.min(startX, endX)
  const maxX = Math.max(startX, endX)
  const minY = Math.min(startY, endY)
  const maxY = Math.max(startY, endY)

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()

  for (let column = 0; column <= columns; column += 1) {
    const x = minX + ((maxX - minX) * column / columns)
    ctx.moveTo(x, minY)
    ctx.lineTo(x, maxY)
  }

  for (let row = 0; row <= rows; row += 1) {
    const y = minY + ((maxY - minY) * row / rows)
    ctx.moveTo(minX, y)
    ctx.lineTo(maxX, y)
  }

  ctx.stroke()
  ctx.restore()
}

const drawRectangleSkeleton = (ctx, pointA, pointB, color, width) => {
  const [startX, startY] = pointA;
  const [endX, endY] = pointB;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  let length = Math.abs(endX - startX);
  let height = Math.abs(endY - startY);
  let x = Math.min(startX, endX);
  let y = Math.min(startY, endY);

  let radius = 0;
  if (length > 20 && height > 20) radius = 10; // TODO: Adjust to be smooth

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + length - radius, y);
  ctx.arc(x + length - radius, y + radius, radius, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(x + length, y + height - radius);
  ctx.arc(x + length - radius, y + height - radius, radius, 0, Math.PI * 0.5);
  ctx.lineTo(x + radius, y + height);
  ctx.arc(x + radius, y + height - radius, radius, Math.PI * 0.5, Math.PI);
  ctx.lineTo(x, y + radius);
  ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.stroke();
}

export const drawLaser = (ctx, figure) => {
  const { points, widthIndex } = figure
  const [innerWidth, otherWidth] = widthList[widthIndex].laser_width;

  const path2DDataOther = getPerfectPath2D(points, {
    size: otherWidth,
    simulatePressure: false,
    start: { taper: true, cap: true },
  });

  const path2DDataInner = getPerfectPath2D(points, {
    size: innerWidth,
    simulatePressure: false,
    start: { taper: true, cap: true },
  });

  ctx.shadowBlur = 10;
  ctx.shadowColor = '#FF2D21';
  ctx.fillStyle = '#EA3323CC';

  ctx.fill(path2DDataOther);

  ctx.fillStyle = '#FFF';

  ctx.fill(path2DDataInner);

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent'; // Reset shadows
}

export const drawEraserTail = (ctx, figure) => {
  const { points, widthIndex } = figure
  const width = widthList[widthIndex].figure_size

  const path2DData = getPerfectPath2D(points, {
    size: width,
    simulatePressure: false,
    start: { taper: true, cap: true },
  });

  ctx.shadowBlur = 10;
  ctx.fillStyle = eraserTailColor;

  ctx.fill(path2DData);

  ctx.shadowBlur = 0;
}

export const drawText = (ctx, figure, updateRainbowColorDeg, isActive, hoveredDot, colorList) => {
  const { points: [startAt], text, scale, width, height, bold = false } = figure;

  const [color, fontSize, font_y_offset_compensation] = detectColorAndFontSize(ctx, figure, updateRainbowColorDeg, colorList)

  drawTextSkeleton(ctx, startAt, text, color, fontSize, font_y_offset_compensation, scale, bold)

  if (isActive) {
    const [startX, startY] = startAt;
    const endX = startX + width * scale;
    const endY = startY + height * scale;

    const startXwithMargin = startX - dotTextMargin
    const startYwithMargin = startY - dotTextMargin
    const endXwithMargin = endX + dotTextMargin
    const endYwithMargin = endY + dotTextMargin

    drawSelectionBox(ctx, startXwithMargin, startYwithMargin, endXwithMargin, endYwithMargin)

    drawDot(ctx, [startXwithMargin, startYwithMargin], hoveredDot === 'pointAScale')
    drawDot(ctx, [endXwithMargin,   endYwithMargin],   hoveredDot === 'pointBScale')
    drawDot(ctx, [startXwithMargin, endYwithMargin],   hoveredDot === 'pointCScale')
    drawDot(ctx, [endXwithMargin,   startYwithMargin], hoveredDot === 'pointDScale')

    // FOR DEV: Обведення прямокутника
    // ctx.strokeStyle = "red";
    // ctx.lineWidth = 1;
    // ctx.strokeRect(startX, startY, width * scale, height * scale);
  }
}

const drawTextSkeleton = (ctx, [startX, startY], text, color, fontSize, font_y_offset_compensation, scale, bold) => {
  ctx.save();
  ctx.translate(startX, startY);
  ctx.scale(scale, scale);

  ctx.textBaseline = "top";
  ctx.font = `${bold ? '700 ' : ''}${fontSize}px Excalifont`;
  ctx.fillStyle = color;

  const lineHeightMultiplier = 1.25;

  const lines = text.split('\n');
  const lineHeight = fontSize * lineHeightMultiplier;

  lines.forEach((line, index) => {
    ctx.fillText(line, 0, index * lineHeight + font_y_offset_compensation);
  });

  ctx.restore();
}

const drawSelectionBox = (ctx, startX, startY, endX, endY) => {
  ctx.strokeStyle = "#6CC3E2";
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, startY, endX - startX, endY - startY);
}

const drawDotsForFigure = (ctx, figure, hoveredDot) => {
  const [pointA, pointB] = figure.points

  drawDot(ctx, pointA, hoveredDot === 'pointA')
  drawDot(ctx, pointB, hoveredDot === 'pointB')

  if (['rectangle', 'square', 'oval', 'circle', 'triangle', 'table'].includes(figure.type)) {
    const [startX, startY] = pointA;
    const [endX, endY] = pointB;

    drawDot(ctx, [startX, endY], hoveredDot === 'pointC')
    drawDot(ctx, [endX, startY], hoveredDot === 'pointD')
  }
}
