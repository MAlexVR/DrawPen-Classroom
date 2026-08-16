import React, { useEffect, useState, useCallback, useRef } from "react";
import "./ToolBar.scss";
import {
  brushList,
  shapeList,
  widthList,
  dashedLineMinDashSize,
  dashedLineMaxDashSize,
  dashedLineMinSpacing,
  dashedLineMaxSpacing,
} from "../constants.js";

const STICKY_DISTANCE = 15;
const ZONE_BORDER = 10; // Equals to "--border-size"*2

const ToolBar = ({
  position,
  setPosition,
  handlePositionChangeComplete,
  toolbarSlide,
  setToolbarSlide,
  isCollapsed,
  setIsCollapsed,
  lastActiveBrush,
  lastActiveFigure,
  activeTool,
  activeColorIndex,
  activeWidthIndex,
  handleCloseToolBar,
  handleChangeColor,
  handleChangeCustomColor,
  handleChangeWidth,
  handleChangeBrushSize,
  handleChangeTableDimensions,
  handleChangeNumberLineRange,
  handleChangeDashedLineStyle,
  handleChangeTool,
  handleClearDesk,
  handleSetWhiteboardMode,
  handleSetWhiteboardPatternStyle,
  handleMakeScreenshot,
  handleEnablePointerMode,
  showWhiteboard,
  whiteboardTheme,
  whiteboardPatternStyle,
  brushSize,
  tableRows,
  tableColumns,
  numberLineMin,
  numberLineMax,
  dashedLineDashSize,
  dashedLineSpacing,
  Icons,
  colorList,
}) => {
  const allIcons = {
    pen: <Icons.Brush />,
    fadepen: <Icons.MagicBrush />,
    arrow: <Icons.Arrow />,
    flat_arrow: <Icons.FlatArrow />,
    rectangle: <Icons.Rectangle />,
    square: <Icons.Square />,
    oval: <Icons.Oval />,
    circle: <Icons.Circle />,
    triangle: <Icons.Triangle />,
    line: <Icons.Line />,
    dashed_line: <Icons.DashedLine />,
    number_line: <Icons.NumberLine />,
    table: <Icons.Table />,
    text: <Icons.Text />,
    highlighter: <Icons.Highlighter />,
    laser: <Icons.Laser />,
    eraser: <Icons.Eraser />,
  };

  const activeColor = colorList[activeColorIndex];

  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef();

  const clampPosition = useCallback((x, y, withSticky = false) => {
    const toInt = (value) => Math.trunc(value);

    if (!toolbarRef.current) {
      return { x: toInt(x), y: toInt(y) };
    }

    const toolbarWidth = toolbarRef.current.offsetWidth;
    const toolbarHeight = toolbarRef.current.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const minX = ZONE_BORDER;
    const minY = ZONE_BORDER;
    const maxX = Math.max(ZONE_BORDER, windowWidth - ZONE_BORDER - toolbarWidth);
    const maxY = Math.max(ZONE_BORDER, windowHeight - ZONE_BORDER - toolbarHeight);

    if (!withSticky) {
      return {
        x: toInt(Math.min(Math.max(x, minX), maxX)),
        y: toInt(Math.min(Math.max(y, minY), maxY)),
      };
    }

    const leftEdge = STICKY_DISTANCE + ZONE_BORDER;
    const topEdge = STICKY_DISTANCE + ZONE_BORDER;
    const rightEdge = windowWidth - ZONE_BORDER - STICKY_DISTANCE;
    const bottomEdge = windowHeight - ZONE_BORDER - STICKY_DISTANCE;

    let nextX = x;
    let nextY = y;

    if (nextX < leftEdge) {
      nextX = minX;
    } else if (nextX + toolbarWidth > rightEdge) {
      nextX = maxX;
    }

    if (nextY < topEdge) {
      nextY = minY;
    } else if (nextY + toolbarHeight > bottomEdge) {
      nextY = maxY;
    }

    return { x: toInt(nextX), y: toInt(nextY) };
  }, []);

  const onPointerDown = (e) => {
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const onPointerMove = useCallback((e) => {
    if (!dragging) return;

    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;

    setPosition(clampPosition(newX, newY, true));
  }, [dragging, offset, clampPosition, setPosition]);

  const onPointerUp = useCallback(() => {
    if (dragging) {
      handlePositionChangeComplete(position);
    }

    setDragging(false);
  }, [dragging, handlePositionChangeComplete, position]);

  useEffect(() => {
    setPosition((prev) => clampPosition(prev.x, prev.y));
  }, [position.x, position.y, clampPosition, setPosition]);

  useEffect(() => {
    const toolbarElement = toolbarRef.current;
    if (!toolbarElement) {
      return;
    }

    let frameId = null;

    const applyClamp = () => {
      setPosition((prev) => {
        const clamped = clampPosition(prev.x, prev.y);
        if (clamped.x === prev.x && clamped.y === prev.y) {
          return prev;
        }

        return clamped;
      });
    };

    const scheduleClamp = () => {
      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        applyClamp();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleClamp);
    resizeObserver.observe(toolbarElement);

    scheduleClamp();
    // window.addEventListener("resize", scheduleClamp);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
      // window.removeEventListener("resize", scheduleClamp);
    };
  }, [clampPosition, setPosition]);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const pickTool = (tool) => {
    handleChangeTool(tool);
    setToolbarSlide("main-slide")
  };

  const onChangeColor = (index) => {
    handleChangeColor(index);
    setToolbarSlide("main-slide")
  };

  const onChangeWidth = (index) => {
    handleChangeWidth(index);
    setToolbarSlide("main-slide")
  };

  const onChangeCustomColor = (color) => {
    handleChangeCustomColor(color);
    setToolbarSlide("main-slide");
  };

  const onChangeWhiteboard = (theme) => {
    handleSetWhiteboardMode(theme);
    setToolbarSlide("main-slide");
  };

  const renderShortcutTitle = (title, ...shortcuts) => {
    const titleShortcuts = shortcuts.filter(Boolean);

    return titleShortcuts.length ? `${title} — ${titleShortcuts.join(" or ")}` : title;
  };

  const renderToolTitle = (tool, ...shortcuts) => {
    const toolTitles = {
      pen:         ["Pen",         "P"],
      fadepen:     ["Fade Pen",    "P"],
      arrow:       ["Arrow",       "A"],
      flat_arrow:  ["Flat Arrow",  "A"],
      rectangle:   ["Rectangle",   "R"],
      square:      ["Square"],
      oval:        ["Oval",        "O"],
      circle:      ["Circle"],
      triangle:    ["Triangle"],
      line:        ["Line"],
      dashed_line: ["Dashed Line"],
      number_line: ["Number Line", "N"],
      table:       ["Table / Matrix"],
      text:        ["Text",        "T"],
      highlighter: ["Highlighter", "H"],
      laser:       ["Laser",       "L"],
      eraser:      ["Eraser",      "E"],
    };

    const [title, ...toolShortcuts] = toolTitles[tool] || ["Tool"];

    return renderShortcutTitle(title, ...toolShortcuts, ...shortcuts);
  };

  const renderMainToolTitle = (tool) => {
    if (brushList.includes(tool)) return renderToolTitle(tool, "1");
    if (shapeList.includes(tool)) return renderToolTitle(tool, "2");
    if (tool === "text") return renderToolTitle(tool, "3");
    if (tool === "highlighter") return renderToolTitle(tool, "4");
    if (tool === "laser") return renderToolTitle(tool, "5");
    if (tool === "eraser") return renderToolTitle(tool, "6");

    return renderToolTitle(tool);
  };

  const renderColorTitle = (color, index) => {
    return renderShortcutTitle(color.title, String(index + 1));
  };

  const renderWidthTitle = (width, index) => {
    return renderShortcutTitle(width.title, String(index + 1));
  };

  const pickFigureOrSwitchView = () => {
    if (shapeList.includes(activeTool)) {
      setToolbarSlide("tool-slide");
    } else {
      pickTool(lastActiveFigure);
    }
  };

  const pickBrushOrSwitchView = () => {
    if (brushList.includes(activeTool)) {
      setToolbarSlide("brush-slide");
    } else {
      pickTool(lastActiveBrush);
    }
  };

  const handleToggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
  };

  const isColorControlDisabled = ["laser", "eraser"].includes(activeTool);
  return (
    <aside
      id="toolbar"
      ref={toolbarRef}
      className={`${toolbarSlide}${isCollapsed ? " toolbar--collapsed" : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      <div className="toolbar__mode-switcher">
        <div className="toolbar__draglines" onPointerDown={onPointerDown}>
          <div className="draglines">
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>

        <div className="toolbar__main-button">
          <button tabIndex={-1} title="Pointer Mode" onClick={handleEnablePointerMode}>
            <Icons.DrawModeEnabled />
          </button>
        </div>

        <div className="toolbar__draglines" onPointerDown={onPointerDown}>
          <div className="draglines">
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>
      </div>

      <div className="toolbar__container">
        <div className="toolbar__panels-track">
          <div className="toolbar__panel toolbar__panel--full">
            <div className="toolbar__body">
              <ul className="toolbar__items">
                <li className={brushList.includes(activeTool) ? "active more_figures" : undefined} onClick={() => pickBrushOrSwitchView()}>
                  <button tabIndex={-1} title={renderMainToolTitle(lastActiveBrush)}>
                    {allIcons[lastActiveBrush]}
                  </button>
                </li>
                <li className={shapeList.includes(activeTool) ? "active more_figures" : undefined} onClick={() => pickFigureOrSwitchView()}>
                  <button tabIndex={-1} title={renderMainToolTitle(lastActiveFigure)}>
                    {allIcons[lastActiveFigure]}
                  </button>
                </li>
                <li className={activeTool === "text" ? "active" : undefined} onClick={() => handleChangeTool("text")}>
                  <button tabIndex={-1} title={renderMainToolTitle("text")}>
                    <Icons.Text />
                  </button>
                </li>
                <li className={activeTool === "highlighter" ? "active" : undefined} onClick={() => handleChangeTool("highlighter")}>
                  <button tabIndex={-1} title={renderMainToolTitle("highlighter")}>
                    <Icons.Highlighter />
                  </button>
                </li>
                <li className={activeTool === "laser" ? "active" : undefined} onClick={() => handleChangeTool("laser")}>
                  <button tabIndex={-1} title={renderMainToolTitle("laser")}>
                    <Icons.Laser />
                  </button>
                </li>
                <li className={activeTool === "eraser" ? "active" : undefined} onClick={() => handleChangeTool("eraser")}>
                  <button tabIndex={-1} title={renderMainToolTitle("eraser")}>
                    <Icons.Eraser />
                  </button>
                </li>
                <li className="cross-line"></li>
                <li onClick={() => !isColorControlDisabled && setToolbarSlide("color-slide")}>
                  <button tabIndex={-1} className={`toolbar__color-picker ${activeColor.isRainbow ? 'color-rainbow' : ''} color_tool_${activeTool}`} style={{ backgroundColor: activeColor.color }} title={isColorControlDisabled ? "Color" : renderShortcutTitle("Color", "7")} />
                </li>
                <li onClick={() => setToolbarSlide("width-slide")}>
                  <button tabIndex={-1} className={`toolbar__width-picker ${widthList[activeWidthIndex].name}`} title={renderShortcutTitle("Brush Size", "8")}>
                    <div />
                  </button>
                </li>
                <li className="cross-line"></li>
                <li className={showWhiteboard ? "active" : undefined} onClick={() => setToolbarSlide("board-slide")}>
                  <button tabIndex={-1} title="White or Black Board">
                    <Icons.Whiteboard />
                  </button>
                </li>
                <li onClick={handleMakeScreenshot}>
                  <button tabIndex={-1} title="Save Full-Screen Screenshot">
                    <Icons.Screenshot />
                  </button>
                </li>
                <li onClick={handleClearDesk}>
                  <button tabIndex={-1} title="Clear Desk">
                    <Icons.Trash />
                  </button>
                </li>
              </ul>
            </div>

          <div className="side-view-body brush-group">
            <ul className="toolbar__items toolbar__brush-items">
              <li className={activeTool === "pen" ? "active" : undefined} onClick={() => pickTool("pen")}>
                <button tabIndex={-1} title={renderToolTitle("pen", "1")}>
                  <Icons.Brush />
                </button>
              </li>
              <li className={activeTool === "fadepen" ? "active" : undefined} onClick={() => pickTool("fadepen")}>
                <button tabIndex={-1} title={renderToolTitle("fadepen", "2")}>
                  <Icons.MagicBrush />
                </button>
              </li>
              <li className="cross-line"></li>
              <li className="toolbar__brush-size-control">
                <div
                  className={`toolbar__brush-size-preview${activeColor.isRainbow ? ' color-rainbow' : ''}`}
                  style={{
                    width: `${brushSize}px`,
                    height: `${brushSize}px`,
                    backgroundColor: activeColor.color,
                  }}
                  title={`${brushSize}px`}
                />
                <input
                  type="range"
                  min="2"
                  max="32"
                  step="1"
                  value={brushSize}
                  aria-label="Brush thickness"
                  title={`Brush thickness: ${brushSize}px`}
                  onChange={(event) => handleChangeBrushSize(Number(event.target.value))}
                />
                <span>{brushSize}px</span>
              </li>
            </ul>
          </div>

          <div className="side-view-body tool-group">
            <ul className="toolbar__items">
              <li className={activeTool === "line" ? "active" : undefined} onClick={() => pickTool("line")}>
                <button tabIndex={-1} title={renderToolTitle("line", "1")}>
                  <Icons.Line />
                </button>
              </li>
              <li className={activeTool === "dashed_line" ? "active more_figures" : "more_figures"} onClick={() => setToolbarSlide("dashed-line-slide")}>
                <button tabIndex={-1} title={renderToolTitle("dashed_line")}>
                  <Icons.DashedLine />
                </button>
              </li>
              <li className={activeTool === "arrow" ? "active" : undefined} onClick={() => pickTool("arrow")}>
                <button tabIndex={-1} title={renderToolTitle("arrow", "2")}>
                  <Icons.Arrow />
                </button>
              </li>
              <li className={activeTool === "flat_arrow" ? "active" : undefined} onClick={() => pickTool("flat_arrow")}>
                <button tabIndex={-1} title={renderToolTitle("flat_arrow", "3")}>
                  <Icons.FlatArrow />
                </button>
              </li>
              <li className={activeTool === "square" ? "active" : undefined} onClick={() => pickTool("square")}>
                <button tabIndex={-1} title={renderToolTitle("square", "4")}>
                  <Icons.Square />
                </button>
              </li>
              <li className={activeTool === "rectangle" ? "active" : undefined} onClick={() => pickTool("rectangle")}>
                <button tabIndex={-1} title={renderToolTitle("rectangle", "5")}>
                  <Icons.Rectangle />
                </button>
              </li>
              <li className={activeTool === "circle" ? "active" : undefined} onClick={() => pickTool("circle")}>
                <button tabIndex={-1} title={renderToolTitle("circle", "6")}>
                  <Icons.Circle />
                </button>
              </li>
              <li className={activeTool === "oval" ? "active" : undefined} onClick={() => pickTool("oval")}>
                <button tabIndex={-1} title={renderToolTitle("oval", "7")}>
                  <Icons.Oval />
                </button>
              </li>
              <li className={activeTool === "triangle" ? "active" : undefined} onClick={() => pickTool("triangle")}>
                <button tabIndex={-1} title={renderToolTitle("triangle", "8")}>
                  <Icons.Triangle />
                </button>
              </li>
              <li className={activeTool === "table" ? "active more_figures" : "more_figures"} onClick={() => setToolbarSlide("table-slide")}>
                <button tabIndex={-1} title={renderToolTitle("table", "9")}>
                  <Icons.Table />
                </button>
              </li>
              <li className={activeTool === "number_line" ? "active more_figures" : "more_figures"} onClick={() => setToolbarSlide("number-line-slide")}>
                <button tabIndex={-1} title={renderToolTitle("number_line")}>
                  <Icons.NumberLine />
                </button>
              </li>
            </ul>
          </div>

          <div className="side-view-body table-group">
            <div className="toolbar__table-control">
              <label title="Rows">
                <span>Rows</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={tableRows}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => handleChangeTableDimensions(event.target.value, tableColumns)}
                />
              </label>
              <span>×</span>
              <label title="Columns">
                <span>Cols</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={tableColumns}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => handleChangeTableDimensions(tableRows, event.target.value)}
                />
              </label>
              <div
                className="toolbar__table-preview"
                style={{ gridTemplateColumns: `repeat(${tableColumns}, 1fr)` }}
                title={`${tableRows} × ${tableColumns}`}
              >
                {Array.from({ length: tableRows * tableColumns }, (_, index) => <i key={index} />)}
              </div>
              <button className="toolbar__table-use" tabIndex={-1} title="Draw Table" onClick={() => pickTool("table")}>
                <Icons.Table />
              </button>
            </div>
          </div>

          <div className="side-view-body number-line-group">
            <div className="toolbar__number-line-control">
              <label title="First number">
                <span>From</span>
                <input
                  type="number"
                  min="-50"
                  max="49"
                  value={numberLineMin}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => handleChangeNumberLineRange(event.target.value, numberLineMax)}
                />
              </label>
              <span>→</span>
              <label title="Last number">
                <span>To</span>
                <input
                  type="number"
                  min="-49"
                  max="50"
                  value={numberLineMax}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => handleChangeNumberLineRange(numberLineMin, event.target.value)}
                />
              </label>
              <div className="toolbar__number-line-preview" title={`${numberLineMin} to ${numberLineMax}`}>
                <i />
                <span>{numberLineMin}</span>
                <span>{Math.round((numberLineMin + numberLineMax) / 2)}</span>
                <span>{numberLineMax}</span>
              </div>
              <button className="toolbar__number-line-use" tabIndex={-1} title="Draw Number Line" onClick={() => pickTool("number_line")}>
                <Icons.NumberLine />
              </button>
            </div>
          </div>

          <div className="side-view-body dashed-line-group">
            <div className="toolbar__dashed-line-control">
              <svg className="toolbar__dashed-line-preview" viewBox="0 0 140 20" aria-hidden="true">
                <line
                  x1="10" y1="10" x2="130" y2="10"
                  stroke={activeColor.color}
                  strokeWidth={widthList[activeWidthIndex].figure_size}
                  strokeLinecap="round"
                  strokeDasharray={`${widthList[activeWidthIndex].figure_size * dashedLineDashSize} ${widthList[activeWidthIndex].figure_size * dashedLineSpacing}`}
                />
              </svg>
              <label title="Dash size">
                <span>Size</span>
                <input
                  type="range"
                  min={dashedLineMinDashSize}
                  max={dashedLineMaxDashSize}
                  step="0.05"
                  value={dashedLineDashSize}
                  onKeyDown={(event) => event.stopPropagation()}
                  aria-label="Dashed line dash size"
                  title="Dash size: dot to pill"
                  onChange={(event) => handleChangeDashedLineStyle(Number(event.target.value), dashedLineSpacing)}
                />
              </label>
              <label title="Spacing">
                <span>Spacing</span>
                <input
                  type="range"
                  min={dashedLineMinSpacing}
                  max={dashedLineMaxSpacing}
                  step="0.25"
                  value={dashedLineSpacing}
                  onKeyDown={(event) => event.stopPropagation()}
                  aria-label="Dashed line spacing"
                  title="Spacing between dashes"
                  onChange={(event) => handleChangeDashedLineStyle(dashedLineDashSize, Number(event.target.value))}
                />
              </label>
              <button className="toolbar__dashed-line-use" tabIndex={-1} title="Draw Dashed Line" onClick={() => pickTool("dashed_line")}>
                <Icons.DashedLine />
              </button>
            </div>
          </div>

          <div className="side-view-body color-group">
            <ul className="toolbar__items">
              {colorList.map((color, index) => color.id === 'color_custom' ? (
                <li key={color.id} className={`toolbar__custom-color-control${activeColorIndex === index ? " active" : ""}`}>
                  <label title="Choose Custom Color">
                    <Icons.CustomColor />
                    <span>Custom</span>
                    <i style={{ backgroundColor: color.color }} />
                    <input
                      type="color"
                      value={color.color}
                      aria-label="Choose Custom Color"
                      onChange={(event) => onChangeCustomColor(event.target.value)}
                    />
                  </label>
                </li>
              ) : (
                <li
                  key={color.id}
                  className={activeColorIndex === index ? "active" : undefined}
                  onClick={() => onChangeColor(index)}
                >
                  <button tabIndex={-1} className={`toolbar__color-picker ${color.isRainbow ? 'color-rainbow' : ''}`} style={{ backgroundColor: color.color }} title={renderColorTitle(color, index)} />
                </li>
              ))}
            </ul>
          </div>

          <div className="side-view-body width-group">
            <ul className="toolbar__items">
              {widthList.map((width, index) => (
                <li
                  key={index}
                  className={activeWidthIndex === index ? "active" : undefined}
                  onClick={() => onChangeWidth(index)}
                >
                  <button tabIndex={-1} className={`toolbar__width-picker ${width.name}`} title={renderWidthTitle(width, index)}>
                    <div />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="side-view-body board-group">
            <ul className="toolbar__items toolbar__board-items">
              <li className={showWhiteboard && whiteboardTheme === "white" ? "active" : undefined} onClick={() => onChangeWhiteboard("white")}>
                <button tabIndex={-1} className="toolbar__board-swatch toolbar__board-swatch--white" title="White Board" />
              </li>
              <li className={showWhiteboard && whiteboardTheme === "black" ? "active" : undefined} onClick={() => onChangeWhiteboard("black")}>
                <button tabIndex={-1} className="toolbar__board-swatch toolbar__board-swatch--black" title="Black Board" />
              </li>
              <li className="cross-line"></li>
              <li className={whiteboardPatternStyle === "plain" ? "active" : undefined} onClick={() => handleSetWhiteboardPatternStyle("plain")}>
                <button tabIndex={-1} className="toolbar__board-pattern toolbar__board-pattern--plain" title="Plain Board" />
              </li>
              <li className={whiteboardPatternStyle === "grid" ? "active" : undefined} onClick={() => handleSetWhiteboardPatternStyle("grid")}>
                <button tabIndex={-1} className="toolbar__board-pattern toolbar__board-pattern--grid" title="Grid Board" />
              </li>
              <li className={!showWhiteboard ? "active" : undefined} onClick={() => onChangeWhiteboard(null)}>
                <button tabIndex={-1} className="toolbar__board-off" title="Hide Board">×</button>
              </li>
            </ul>
          </div>
          </div>

          <div className="toolbar__panel toolbar__panel--mini">
            <div className="toolbar__body">
              <ul className="toolbar__items">
                <li className="active" onClick={handleToggleCollapsed}>
                  <button tabIndex={-1} title={renderMainToolTitle(activeTool)}>
                    {allIcons[activeTool]}
                  </button>
                </li>

                <div className="toolbar__color-hint-wrapper" onClick={handleToggleCollapsed}>
                  <div className={`toolbar__color-hint color_tool_${activeTool} ${activeColor.isRainbow ? 'color-rainbow' : ''} ${widthList[activeWidthIndex].name}`} style={{ backgroundColor: activeColor.color }}></div>
                </div>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar__slider" onClick={handleToggleCollapsed}>
        {
          isCollapsed ? <Icons.AngleRight /> : <Icons.AngleLeft />
        }
      </div>

      <div className="toolbar__close">
        <button tabIndex={-1} onClick={handleCloseToolBar}>
          <Icons.Close size={16} />
        </button>
      </div>
    </aside>
  );
};

export default ToolBar;
