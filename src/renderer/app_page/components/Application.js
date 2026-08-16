import './Application.scss';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { throttle, debounce } from 'lodash';
import DrawDesk from './components/DrawDesk.js';
import ToolBar from './components/ToolBar.js';
import CuteCursor from './components/CuteCursor.js';
import RippleEffect from './components/RippleEffect.js';
import Toast from './components/Toast.js';
import TextEditor from './components/TextEditor.js';
import Whiteboard from './components/Whiteboard.js';
import {
  filterClosePoints,
  getMouseCoordinates,
  distanceBetweenPoints,
  calculateCanvasTextWidth,
  applySoftSnap,
  applyAspectRatioLock,
} from './utils/general.js';
import {
  isOnFigure,
  isOverFigure,
  areFiguresIntersecting,
  getDotNameOnFigure,
  getDotOffsetCoordinates,
  dragFigure,
  resizeFigure,
  moveToCoordinates,
  calculateAspectRatio,
} from './utils/figureDetection.js';
import { FaPaintBrush, FaHighlighter, FaRegSquare, FaArrowRight, FaLongArrowAltRight, FaEraser, FaRegTrashAlt, FaAngleLeft, FaAngleRight } from "react-icons/fa";
import { AiOutlineLine } from "react-icons/ai";
import { GiLaserburn } from "react-icons/gi";
import { MdOutlineClose } from "react-icons/md";
import { FaFont } from "react-icons/fa6";
import { LuSquareMousePointer, LuPresentation, LuCamera, LuTable2, LuRectangleHorizontal, LuCircle, LuTriangle, LuPalette, LuRuler } from "react-icons/lu";
import { TbOval, TbLineDashed } from "react-icons/tb";
import FaMagicPaintBrush from "./components/icons/FaMagicPaintBrush.js";

import {
  fadeOutDestroyAfterMs,
  eraserTime,
  brushList,
  shapeList,
  penVariantList,
  arrowVariantList,
  createApplicationColorList,
  widthList,
  minObjectDistance,
  pastCooldownMs,
  escDoubleTapMs,
  isLightColor,
} from './constants.js'

const Icons = {
  DrawModeEnabled: LuSquareMousePointer,
  Close: MdOutlineClose,
  Brush: FaPaintBrush,
  MagicBrush: FaMagicPaintBrush,
  Arrow: FaArrowRight,
  FlatArrow: FaLongArrowAltRight,
  Square: FaRegSquare,
  Rectangle: LuRectangleHorizontal,
  Circle: LuCircle,
  Oval: TbOval,
  Triangle: LuTriangle,
  Line: AiOutlineLine,
  DashedLine: TbLineDashed,
  Text: FaFont,
  Highlighter: FaHighlighter,
  Laser: GiLaserburn,
  Eraser: FaEraser,
  Trash: FaRegTrashAlt,
  AngleLeft: FaAngleLeft,
  AngleRight: FaAngleRight,
  Whiteboard: LuPresentation,
  Screenshot: LuCamera,
  Table: LuTable2,
  CustomColor: LuPalette,
  NumberLine: LuRuler,
};

const afterTwoAnimationFrames = (callback) => {
  requestAnimationFrame(() => requestAnimationFrame(callback));
};

const Application = (settings) => {
  // console.log('App render');

  const initialColorDeg = Math.random() * 360
  const initialActiveTool = settings.tool_bar_active_tool
  const initialActiveColor = settings.tool_bar_active_color_index
  const initialActiveWidth = settings.tool_bar_active_weight_index
  const initialBrushSize = settings.tool_bar_brush_size
  const initialTableRows = settings.table_rows
  const initialTableColumns = settings.table_columns
  const initialNumberLineMin = settings.number_line_min
  const initialNumberLineMax = settings.number_line_max
  const initialDashedLineDashSize = settings.dashed_line_dash_size
  const initialDashedLineSpacing = settings.dashed_line_spacing
  const initialShowToolbar = settings.show_tool_bar
  const initialShowWhiteboard = settings.show_whiteboard
  const initialWhiteboardTheme = settings.whiteboard_color
  const initialWhiteboardLayout = settings.whiteboard_layout
  const initialWhiteboardOpacity = settings.whiteboard_opacity
  const initialWhiteboardStyle = settings.whiteboard_style
  const initialWhiteboardSpacing = settings.whiteboard_spacing
  const initialShowDrawingBorder = settings.show_drawing_border
  const initialShowCuteCursor = settings.show_cute_cursor
  const initialPenSmoothing = settings.pen_smoothing
  const initialClearDrawingsOnHide = settings.clear_drawings_on_hide
  const initialToolbarDefaultBrush = settings.tool_bar_default_brush
  const initialToolbarDefaultFigure = settings.tool_bar_default_figure
  const initialToolbarCollapsed = settings.tool_bar_collapsed
  const toolbarWindowContentOffsetY = settings.tool_bar_window_content_offset_y || 0
  const initialToolbarPosition = {
    x: settings.tool_bar_x,
    y: settings.tool_bar_y - toolbarWindowContentOffsetY,
  }
  const [initialMainColorIndex, initialSecondaryColorIndex] = settings.swap_colors_indexes
  const initialLaserTime = settings.laser_time
  const initialFadeDisappearAfterMs = settings.fade_disappear_after_ms
  const initialFadeOutDurationTimeMs = settings.fade_out_duration_time_ms
  const initialLastActivePen = [initialActiveTool, initialToolbarDefaultBrush].find(tool => penVariantList.includes(tool)) || penVariantList[0]
  const initialLastActiveArrow = [initialActiveTool, initialToolbarDefaultFigure].find(tool => arrowVariantList.includes(tool)) || arrowVariantList[0]

  const key_show_hide_toolbar       = settings.key_binding_show_hide_toolbar
  const key_show_hide_whiteboard    = settings.key_binding_show_hide_whiteboard
  const key_clear_desk              = settings.key_binding_clear_desk
  const key_binding_open_settings   = settings.key_binding_open_settings
  const key_binding_make_screenshot = settings.key_binding_make_screenshot

  let initialFigures = []

  if (process.env.NODE_ENV === 'development') {
    initialFigures = [
      { id: Date.now() + 0, type: 'arrow',     colorIndex: 0, widthIndex: 2, points: [[100, 100], [400, 100]], rainbowColorDeg: (Math.random() * 360) },
      { id: Date.now() + 1, type: 'line',      colorIndex: 0, widthIndex: 2, points: [[100, 200], [400, 200]], rainbowColorDeg: 250 },
      { id: Date.now() + 2, type: 'rectangle', colorIndex: 0, widthIndex: 2, points: [[70, 150], [450, 250]],  rainbowColorDeg: (Math.random() * 360), ratio: 1 },
      { id: Date.now() + 3, type: 'oval',      colorIndex: 0, widthIndex: 2, points: [[100, 300], [400, 450]], rainbowColorDeg: (Math.random() * 360), ratio: 1 },
      { id: Date.now() + 4, type: 'text',      colorIndex: 2, widthIndex: 2, points: [[152, 118]],             rainbowColorDeg: (Math.random() * 360), text: 'Hello World', width: 400, height: 150, scale: 1 },
    ]
  }

  const [colorList, setColorList] = useState(() => createApplicationColorList(settings.tool_bar_color_palette));
  const [rainbowColorDeg, updateRainbowColorDeg] = useState(initialColorDeg);
  const [mouseCoordinates, setMouseCoordinates] = useState({ x: 0, y: 0 });
  const [allFigures, setAllFigures] = useState(initialFigures);
  const [allLaserFigures, setLaserFigure] = useState([]);
  const [allEraserFigures, setEraserFigure] = useState([]);
  const [allFadeFigures, setFadeFigures] = useState([]);
  const [activeTool, setActiveTool] = useState(initialActiveTool);
  const [activeFigureInfo, setActiveFigureInfo] = useState(null);
  const [activeColorIndex, setActiveColorIndex] = useState(initialActiveColor);
  const [activeWidthIndex, setActiveWidthIndex] = useState(initialActiveWidth);
  const [brushSize, setBrushSize] = useState(initialBrushSize);
  const [tableRows, setTableRows] = useState(initialTableRows);
  const [tableColumns, setTableColumns] = useState(initialTableColumns);
  const [numberLineMin, setNumberLineMin] = useState(initialNumberLineMin);
  const [numberLineMax, setNumberLineMax] = useState(initialNumberLineMax);
  const [dashedLineDashSize, setDashedLineDashSize] = useState(initialDashedLineDashSize);
  const [dashedLineSpacing, setDashedLineSpacing] = useState(initialDashedLineSpacing);
  const [isDrawing, setIsDrawing] = useState(false);
  const [textEditorContainer, setTextEditorContainer] = useState(null);
  const [cursorType, setCursorType] = useState('crosshair');
  const [showToolbar, setShowToolbar] = useState(initialShowToolbar);
  const [showWhiteboard, setShowWhiteboard] = useState(initialShowWhiteboard);
  const [whiteboardTheme, setWhiteboardTheme] = useState(initialWhiteboardTheme);
  const [whiteboardLayout, setWhiteboardLayout] = useState(initialWhiteboardLayout);
  const [whiteboardOpacity, setWhiteboardOpacity] = useState(initialWhiteboardOpacity);
  const [whiteboardPatternStyle, setWhiteboardPatternStyle] = useState(initialWhiteboardStyle);
  const [whiteboardSpacing, setWhiteboardSpacing] = useState(initialWhiteboardSpacing);
  const [toolbarLastActiveBrush, setToolbarLastActiveBrush] = useState(initialToolbarDefaultBrush);
  const [toolbarLastActiveFigure, setToolbarLastActiveFigure] = useState(initialToolbarDefaultFigure);
  const [lastActivePen, setLastActivePen] = useState(initialLastActivePen);
  const [lastActiveArrow, setLastActiveArrow] = useState(initialLastActiveArrow);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(initialToolbarCollapsed);
  const [toolbarPosition, setToolbarPosition] = useState(initialToolbarPosition);
  const [toolbarPositionReady, setToolbarPositionReady] = useState(false);
  const [toolbarSlide, setToolbarSlide] = useState('main-slide');
  const [rippleEffects, setRippleEffects] = useState([]);
  const [undoStackFigures, setUndoStackFigures] = useState([]);
  const [redoStackFigures, setRedoStackFigures] = useState([]);
  const [clipboardFigure, setClipboardFigure] = useState(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isFadeDrawing, setIsFadeDrawing] = useState(false);
  const [showDrawingBorder, setShowDrawingBorder] = useState(initialShowDrawingBorder);
  const [showCuteCursor, setShowCuteCursor] = useState(initialShowCuteCursor);
  const [penSmoothing, setPenSmoothing] = useState(initialPenSmoothing);
  const [clearDrawingsOnHide, setClearDrawingsOnHide] = useState(initialClearDrawingsOnHide);
  const [mainColorIndex, setMainColorIndex] = useState(initialMainColorIndex);
  const [secondaryColorIndex, setSecondaryColorIndex] = useState(initialSecondaryColorIndex);
  const [toastInfo, setToastInfo] = useState(null);
  const [fadeOpacity, setFadeOpacity] = useState(1.0);

  useEffect(() => {
    window.electronAPI.onResetScreen(handleReset);
    window.electronAPI.onToggleToolbar(handleToggleToolbar);
    window.electronAPI.onToggleWhiteboard(handleToggleWhiteboard);
    window.electronAPI.onRefreshSettings(handleRefreshSettings);
    window.electronAPI.onPrepareDrawToolbar(handlePrepareDrawToolbar);
    window.electronAPI.onApplyDrawToolbarPosition(handleApplyDrawToolbarPosition);
    window.electronAPI.onUpdateToolbarPosition(handleUpdateToolbarPosition);
    window.electronAPI.onShowNotification(handleShowNotification);
  }, []);

  const lastPasteAtRef = useRef(0);
  const lastEscapeAtRef = useRef(0);

  const handleKeyDown = useCallback((event) => {
    const eventKey = (event.key || '').toLowerCase();
    const eventCode = (event.code || '').toLowerCase();
    const ctrlOrMeta = event.ctrlKey || event.metaKey;
    const shiftKey = event.shiftKey;
    const eventRepeat = event.repeat;

    const direction = shiftKey ? -1 : 1;

    const getNextVariant = (variantList, activeVariant, direction = 1) => {
      const activeVariantIndex = variantList.indexOf(activeVariant);

      if (activeVariantIndex === -1) {
        return variantList[0];
      }

      return variantList[(activeVariantIndex + direction + variantList.length) % variantList.length];
    };

    if (textEditorContainer) {
      return
    }

    if (eventKey === 'shift' && !eventRepeat) {
      setIsShiftPressed(true);
    }

    if (eventCode === 'space' && !eventRepeat) {
      setIsSpacePressed(true);
    }

    if (isDrawing || isActiveFigureMoving()) {
      return
    }

    // Dynamic keyboard shortcuts
    if (eventMatches(event, key_show_hide_toolbar)) {
      event.preventDefault();
      handleToggleToolbar();
      return
    }
    if (eventMatches(event, key_show_hide_whiteboard)) {
      event.preventDefault();
      handleToggleWhiteboard();
      return
    }
    if (eventMatches(event, key_clear_desk)) {
      event.preventDefault();
      handleReset();
      return
    }
    if (eventMatches(event, key_binding_open_settings)) {
      event.preventDefault();
      invokeOpenSettings();
      return
    }
    if (eventMatches(event, key_binding_make_screenshot)) {
      event.preventDefault();
      invokeMakeScreenshot();
      return
    }

    if (ctrlOrMeta && !['v', 'c', 'z'].includes(eventKey)) {
      return
    }

    if (eventCode === 'keyx') {
      if (['eraser', 'laser'].includes(activeTool)) {
        return;
      }

      if (activeColorIndex !== mainColorIndex) {
        handleChangeColor(mainColorIndex);
        return;
      }

      if (activeColorIndex !== secondaryColorIndex) {
        handleChangeColor(secondaryColorIndex);
        return;
      }

      return;
    }

    // Static keyboard shortcuts
    switch (eventKey) {
      case 'v': {
        if (ctrlOrMeta) {
          if (clipboardFigure) {
            const now = Date.now();
            if (now - lastPasteAtRef.current < pastCooldownMs) return;
            lastPasteAtRef.current = now;

            const { x, y } = mouseCoordinates;

            const newFigure = {
              ...clipboardFigure,
              id: Date.now(),
              points: moveToCoordinates(clipboardFigure, x, y),
            };

            setActiveFigureInfo({ id: newFigure.id, x, y });
            setAllFigures(prevAllFigures => [...prevAllFigures, newFigure]);

            setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'add', figures: [newFigure] }]);
            setRedoStackFigures([]);
          }
        }

        break;
      }
      case 'c': {
        if (ctrlOrMeta) {
          if (activeFigureInfo) {
            const activeFigure = findActiveFigure();

            setClipboardFigure({
              ...activeFigure,
              points: activeFigure.points.map(p => [...p]) // Avoid mutation
            });
          }
        }

        break;
      }
      case 'z': {
        if (ctrlOrMeta) {
          if (activeFigureInfo) {
            setActiveFigureInfo(null);
            break;
          }

          // REDO:
          if (shiftKey) {
            if (redoStackFigures.length > 0) {
              const lastAction = redoStackFigures.at(-1);
              let newActiveFigures

              if (lastAction.type === 'add') {
                newActiveFigures = [...allFigures, ...lastAction.figures];
              }

              if (lastAction.type === 'remove') {
                newActiveFigures = allFigures.filter(figure => !lastAction.figures.some(f => f.id === figure.id))
              }

              setAllFigures(newActiveFigures);
              setUndoStackFigures(prevUndoStack => [...prevUndoStack, lastAction]);
              setRedoStackFigures(prevRedoStack => prevRedoStack.slice(0, -1));
            }

            break;
          }

          // UNDO:
          if (undoStackFigures.length > 0) {
            const lastAction = undoStackFigures.at(-1);
            let newActiveFigures

            if (lastAction.type === 'add') {
              newActiveFigures = allFigures.filter(figure => !lastAction.figures.some(f => f.id === figure.id))
            }

            if (lastAction.type === 'remove') {
              newActiveFigures = [...allFigures, ...lastAction.figures];
            }

            setAllFigures(newActiveFigures);
            setUndoStackFigures(prevUndoStack => prevUndoStack.slice(0, -1));
            setRedoStackFigures(prevRedoStack => [...prevRedoStack, lastAction]);
          }
        }
        break;
      }
      case 'p': {
        if (penVariantList.includes(activeTool)) {
          handleChangeTool(getNextVariant(penVariantList, activeTool));
        } else {
          handleChangeTool(lastActivePen);
        }
        break;
      }
      case 'a': {
        if (arrowVariantList.includes(activeTool)) {
          handleChangeTool(getNextVariant(arrowVariantList, activeTool));
        } else {
          handleChangeTool(lastActiveArrow);
        }
        break;
      }
      case 'r': {
        handleChangeTool('rectangle');
        break;
      }
      case 'n': {
        handleChangeTool('number_line');
        break;
      }
      case 'o': {
        handleChangeTool('oval');
        break;
      }
      case 't': {
        handleChangeTool('text');
        break;
      }
      case 'h': {
        handleChangeTool('highlighter');
        break;
      }
      case 'l': {
        handleChangeTool('laser');
        break;
      }
      case 'e': {
        handleChangeTool('eraser');
        break;
      }
      case 'arrowleft':
      case 'arrowright':
      case 'arrowup':
      case 'arrowdown': {
        if (activeFigureInfo) {
          const activeFigure = findActiveFigure()

          let offset = 2;
          if (shiftKey) { offset *= 5 }

          const directionMap = {
            arrowleft:  [-offset, 0],
            arrowright: [offset, 0],
            arrowup:    [0, -offset],
            arrowdown:  [0, offset],
          };

          const [dx, dy] = directionMap[eventKey];

          activeFigure.points.forEach((point) => {
            point[0] += dx;
            point[1] += dy;
          });

          setAllFigures([...allFigures]);
        }
        break;
      }
      case 'delete':
      case 'backspace': {
        if (activeFigureInfo) {
          const figureToRemove = allFigures.find(figure => figure.id === activeFigureInfo.id);
          const newActiveFigures = allFigures.filter(figure => figure.id !== activeFigureInfo.id)

          setActiveFigureInfo(null);
          setAllFigures(newActiveFigures);

          setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'remove', figures: [figureToRemove] }]);
          setRedoStackFigures([]);
        }
        break;
      }
      case 'enter': {
        if (activeFigureInfo) {
          const activeFigure = findActiveFigure()

          if (activeFigure.type === 'text') {
            activateTextEditor(activeFigure);

            event.preventDefault();
          }
        }
        break;
      }
      case 'escape': {
        if (eventRepeat) break;

        if (toolbarSlide !== 'main-slide') {
          setToolbarSlide('main-slide');
          break;
        }

        if (activeFigureInfo) {
          setActiveFigureInfo(null);
          break;
        }

        const now = Date.now();
        if (now - lastEscapeAtRef.current < escDoubleTapMs) {
          lastEscapeAtRef.current = 0;
          invokePointerMode();
        } else {
          lastEscapeAtRef.current = now;
        }

        break;
      }
    }

    if (toolbarSlide === 'main-slide') {
      switch (eventCode) {
        case 'digit1': {
          let nextBrush = toolbarLastActiveBrush;

          if (activeTool === toolbarLastActiveBrush) {
            nextBrush = getNextVariant(brushList, activeTool, direction);
          }

          handleChangeTool(nextBrush);
          break;
        }
        case 'digit2': {
          let nextShape = toolbarLastActiveFigure;

          if (activeTool === toolbarLastActiveFigure) {
            nextShape = getNextVariant(shapeList, activeTool, direction);
          }

          handleChangeTool(nextShape);
          break;
        }
        case 'digit3': {
          handleChangeTool('text');
          break;
        }
        case 'digit4': {
          handleChangeTool('highlighter');
          break;
        }
        case 'digit5': {
          handleChangeTool('laser');
          break;
        }
        case 'digit6': {
          handleChangeTool('eraser');
          break;
        }
        case 'digit7': {
          if (['eraser', 'laser'].includes(activeTool)) {
            break;
          }
          const nextColorIndex = (activeColorIndex + direction + colorList.length) % colorList.length;

          handleChangeColor(nextColorIndex);
          break;
        }
        case 'digit8': {
          const nextWidthIndex = (activeWidthIndex + direction + widthList.length) % widthList.length;

          handleChangeWidth(nextWidthIndex);
          break;
        }
      }

      return;
    }

    let digitIndex = null;
    if (eventCode === 'digit1') digitIndex = 0;
    if (eventCode === 'digit2') digitIndex = 1;
    if (eventCode === 'digit3') digitIndex = 2;
    if (eventCode === 'digit4') digitIndex = 3;
    if (eventCode === 'digit5') digitIndex = 4;
    if (eventCode === 'digit6') digitIndex = 5;
    if (eventCode === 'digit7') digitIndex = 6;
    if (eventCode === 'digit8') digitIndex = 7;
    if (eventCode === 'digit9') digitIndex = 8;
    if (digitIndex === null) return;

    switch (toolbarSlide) {
      case 'brush-slide': {
        if (digitIndex < brushList.length) {
          handleChangeTool(brushList[digitIndex]);
          setToolbarSlide("main-slide");
        }
        break;
      }

      case 'tool-slide':
        if (digitIndex < shapeList.length) {
          handleChangeTool(shapeList[digitIndex]);
          setToolbarSlide("main-slide");
        }
        break;

      case 'color-slide':
        if (digitIndex < colorList.length) {
          handleChangeColor(digitIndex);
          setToolbarSlide("main-slide");
        }
        break;

      case 'width-slide':
        if (digitIndex < widthList.length) {
          handleChangeWidth(digitIndex);
          setToolbarSlide("main-slide");
        }
        break;
    }
  }, [allFigures, undoStackFigures, redoStackFigures, clipboardFigure, isDrawing, activeFigureInfo, activeTool, activeColorIndex, activeWidthIndex, toolbarLastActiveBrush, toolbarLastActiveFigure, lastActivePen, lastActiveArrow, toolbarSlide, toolbarPosition, textEditorContainer, mouseCoordinates, mainColorIndex, secondaryColorIndex, colorList]);

  const handleKeyUp = useCallback((event) => {
    const eventKey = (event.key || '').toLowerCase();
    const eventCode = (event.code || '').toLowerCase();

    if (textEditorContainer) {
      return
    }

    if (eventKey === 'shift') {
      setIsShiftPressed(false);
    }

    if (eventCode === 'space') {
      setIsSpacePressed(false);

      event.preventDefault();
    }
  }, [textEditorContainer]);

  const parseAccelerator = (shortcut) => {
    if (!shortcut) return null
    if (shortcut === '[NULL]') return null

    const keyParts = shortcut.split('+')
    let mainKey = keyParts[keyParts.length - 1].toUpperCase();

    if (mainKey.length === 1 && mainKey >= '0' && mainKey <= '9') {
      mainKey = `DIGIT${mainKey}`;
    }

    return {
      wantMeta: keyParts.includes('Meta'),
      wantCtrl: keyParts.includes('Control'),
      wantAlt: keyParts.includes('Alt'),
      wantShift: keyParts.includes('Shift'),
      mainKey: mainKey,
    };
  }

  const eventMatches = (event, shortcut) => {
    const eventKey = (event.key || '').toUpperCase()
    const eventCode = (event.code || '').toUpperCase()
    const ctrlKey = event.ctrlKey
    const metaKey = event.metaKey
    const shiftKey = event.shiftKey
    const eventRepeat = event.repeat

    if (eventRepeat) return false;

    const accelOptions = parseAccelerator(shortcut);
    if (!accelOptions) return false;

    const pressedKey = eventCode.startsWith('DIGIT') ? eventCode : eventKey;

    return (
      (accelOptions.mainKey === pressedKey) &&
      (accelOptions.wantMeta === metaKey) &&
      (accelOptions.wantCtrl === ctrlKey) &&
      (accelOptions.wantShift === shiftKey) &&
      (accelOptions.wantAlt === event.altKey)
    )
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    setToolbarSlide('main-slide');
  }, [activeTool, activeColorIndex, activeWidthIndex]);

  const firstLaunch = useRef(true);
  useEffect(() => {
    if (firstLaunch.current) {
      firstLaunch.current = false;
      return;
    }

    if (activeTool === 'eraser') {
      return;
    }

    const debouncedUpdateSettings = debounce(() => {
      invokeSetSettings({
        show_whiteboard: showWhiteboard,
        show_tool_bar: showToolbar,
        tool_bar_active_tool: activeTool,
        tool_bar_active_color_index: activeColorIndex,
        tool_bar_active_weight_index: activeWidthIndex,
        tool_bar_brush_size: brushSize,
        table_rows: tableRows,
        table_columns: tableColumns,
        number_line_min: numberLineMin,
        number_line_max: numberLineMax,
        dashed_line_dash_size: dashedLineDashSize,
        dashed_line_spacing: dashedLineSpacing,
        tool_bar_default_brush: toolbarLastActiveBrush,
        tool_bar_default_figure: toolbarLastActiveFigure,
        tool_bar_collapsed: toolbarCollapsed,
      });
    }, 300);

    debouncedUpdateSettings();

    return () => {
      debouncedUpdateSettings.cancel();
    };
  }, [showWhiteboard, showToolbar, activeTool, activeColorIndex, activeWidthIndex, brushSize, tableRows, tableColumns, numberLineMin, numberLineMax, dashedLineDashSize, dashedLineSpacing, toolbarLastActiveBrush, toolbarLastActiveFigure, toolbarCollapsed]);

  useEffect(() => {
    if (!activeFigureInfo) { return }

    const activeFigure = findActiveFigure();

    setActiveColorIndex(activeFigure.colorIndex)
    setActiveWidthIndex(activeFigure.widthIndex)
    if (brushList.includes(activeFigure.type) && Number.isFinite(activeFigure.brushSize)) {
      setBrushSize(activeFigure.brushSize)
    }
    if (activeFigure.type === 'table') {
      setTableRows(activeFigure.rows)
      setTableColumns(activeFigure.columns)
    }
    if (activeFigure.type === 'number_line') {
      setNumberLineMin(activeFigure.minimum)
      setNumberLineMax(activeFigure.maximum)
    }
    if (activeFigure.type === 'dashed_line' && Number.isFinite(activeFigure.dashSize) && Number.isFinite(activeFigure.dashSpacing)) {
      setDashedLineDashSize(activeFigure.dashSize)
      setDashedLineSpacing(activeFigure.dashSpacing)
    }
  }, [activeFigureInfo])

  const allLasersFiguresByRef = useRef(null)
  useEffect(() => {
    allLasersFiguresByRef.current = allLaserFigures;
  }, [allLaserFigures]);

  const allErasersFiguresByRef = useRef(null)
  useEffect(() => {
    allErasersFiguresByRef.current = allEraserFigures;
  }, [allEraserFigures]);

  const idleTimerRef = useRef(null);
  const fadeRafRef = useRef(null);
  const allFadeFiguresByRef = useRef(null)
  useEffect(() => {
    allFadeFiguresByRef.current = allFadeFigures;
  }, [allFadeFigures]);

  useEffect(() => {
    const fadePaused = isSpacePressed || isFadeDrawing;

    if (fadePaused) {
      resetFadeTimer();
    }

    if (!fadePaused && allFadeFiguresByRef.current.length > 0) {
      startIdleTimer();
    }
  }, [isSpacePressed, isFadeDrawing]);

  const startIdleTimer = () => {
    resetFadeTimer();

    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null;
      startFading();
    }, initialFadeDisappearAfterMs);
  }

  const resetFadeTimer = () => {
    setFadeOpacity(1.0);

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (fadeRafRef.current) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }

  const getFadeOpacity = (elapsedMs, opacityDuration) => {
    let progress = 1 - (elapsedMs / opacityDuration);

    if (progress < 0) progress = 0; // clamp to 0..1
    if (progress > 1) progress = 1;

    return Math.round(progress * 100) / 100; // round to 0.01
  };

  const startFading = () => {
    const fadeStartAt = Date.now();
    let memoLastOpacity = null;

    const tick = () => {
      if (!fadeRafRef.current) return;

      const now = Date.now();
      const elapsedMs = now - fadeStartAt;
      const opacity = getFadeOpacity(elapsedMs, initialFadeOutDurationTimeMs)

      if (memoLastOpacity !== opacity) {
        memoLastOpacity = opacity;

        setFadeOpacity(opacity);
      }

      if (elapsedMs >= (initialFadeOutDurationTimeMs + fadeOutDestroyAfterMs)) {
        setFadeFigures([]);

        fadeRafRef.current = null;
        return;
      }

      fadeRafRef.current = requestAnimationFrame(tick);
    };

    fadeRafRef.current = requestAnimationFrame(tick);
  }

  const isActiveFigureMoving = () => {
    return activeFigureInfo && (activeFigureInfo.dragging || activeFigureInfo.resizing)
  }

  const findActiveFigure = () => {
    return allFigures.find((figure) => figure.id === activeFigureInfo.id);
  }

  const scheduleClearLaserTail = (id) => {
    // https://felixgerschau.com/react-hooks-settimeout/
    setTimeout(() => {
      const updatedLaserFigures = clearTail(id, allLasersFiguresByRef.current);

      setLaserFigure([...updatedLaserFigures])
    }, initialLaserTime)
  }

  const scheduleClearEraserTail = (id) => {
    setTimeout(() => {
      const updatedEraserFigures = clearTail(id, allErasersFiguresByRef.current);

      setEraserFigure([...updatedEraserFigures])
    }, eraserTime)
  }

  const clearTail = (id, figures) => {
    const figure = figures.find(figure => figure.id === id);
    if (figure) {
      figure.points.shift();
    }

    return figures
  }

  const handleChangeColor = (newColorIndex) => {
    if (activeFigureInfo) {
      const activeFigure = findActiveFigure()

      activeFigure.colorIndex = newColorIndex
    }

    setActiveColorIndex(newColorIndex);
    setAllFigures([...allFigures]);
  };

  const handleChangeCustomColor = (newColor) => {
    const normalizedColor = newColor.toUpperCase();
    const customColorIndex = colorList.findIndex(color => color.id === 'color_custom');
    if (customColorIndex === -1) return;

    setColorList(prevColorList => prevColorList.map((color, index) => (
      index === customColorIndex
        ? {
            ...color,
            color: normalizedColor,
            title: 'Custom Color',
            isLightColor: isLightColor(normalizedColor),
          }
        : color
    )));

    handleChangeColor(customColorIndex);
    window.electronAPI.invokeSetToolbarColor('color_custom', normalizedColor);
  };

  const handleChangeWidth = (newWidthIndex) => {
    if (activeFigureInfo) {
      const activeFigure = findActiveFigure()

      activeFigure.widthIndex = newWidthIndex

      if (activeFigure.type === 'text') {
        const [width, height] = calculateCanvasTextWidth(activeFigure.text, activeFigure.widthIndex, activeFigure.bold);

        activeFigure.width = width;
        activeFigure.height = height;
        activeFigure.scale = 1;
      }
    }

    setActiveWidthIndex(newWidthIndex);
    setAllFigures([...allFigures]);
  };

  const handleChangeBrushSize = (newBrushSize) => {
    const normalizedBrushSize = Math.min(32, Math.max(2, Number(newBrushSize)));

    if (activeFigureInfo) {
      const activeFigure = findActiveFigure();
      if (activeFigure && brushList.includes(activeFigure.type)) {
        activeFigure.brushSize = normalizedBrushSize;
      }
    }

    setBrushSize(normalizedBrushSize);
    setAllFigures([...allFigures]);
  };

  const handleChangeTableDimensions = (rows, columns) => {
    const normalizedRows = Math.min(20, Math.max(1, Number(rows)));
    const normalizedColumns = Math.min(20, Math.max(1, Number(columns)));

    if (activeFigureInfo) {
      const activeFigure = findActiveFigure();
      if (activeFigure?.type === 'table') {
        activeFigure.rows = normalizedRows;
        activeFigure.columns = normalizedColumns;
      }
    }

    setTableRows(normalizedRows);
    setTableColumns(normalizedColumns);
    setAllFigures([...allFigures]);
  };

  const handleChangeNumberLineRange = (minimum, maximum) => {
    let normalizedMinimum = Math.round(Math.min(49, Math.max(-50, Number(minimum))));
    let normalizedMaximum = Math.round(Math.min(50, Math.max(-49, Number(maximum))));

    if (!Number.isFinite(normalizedMinimum) || !Number.isFinite(normalizedMaximum)) return;

    if (normalizedMinimum >= normalizedMaximum) {
      if (normalizedMinimum < 50) {
        normalizedMaximum = normalizedMinimum + 1;
      } else {
        normalizedMinimum = normalizedMaximum - 1;
      }
    }

    if (activeFigureInfo) {
      const activeFigure = findActiveFigure();
      if (activeFigure?.type === 'number_line') {
        activeFigure.minimum = normalizedMinimum;
        activeFigure.maximum = normalizedMaximum;
      }
    }

    setNumberLineMin(normalizedMinimum);
    setNumberLineMax(normalizedMaximum);
    setAllFigures([...allFigures]);
  };

  const handleChangeDashedLineStyle = (dashSize, spacing) => {
    const normalizedDashSize = Math.min(4, Math.max(0, Number(dashSize)));
    const normalizedSpacing = Math.min(8, Math.max(1, Number(spacing)));

    if (!Number.isFinite(normalizedDashSize) || !Number.isFinite(normalizedSpacing)) return;

    if (activeFigureInfo) {
      const activeFigure = findActiveFigure();
      if (activeFigure?.type === 'dashed_line') {
        activeFigure.dashSize = normalizedDashSize;
        activeFigure.dashSpacing = normalizedSpacing;
      }
    }

    setDashedLineDashSize(normalizedDashSize);
    setDashedLineSpacing(normalizedSpacing);
    setAllFigures([...allFigures]);
  };

  const handleChangeTool = (toolName) => {
    if (activeTool === toolName) {
      return
    }

    setActiveFigureInfo(null);
    setActiveTool(toolName);

    if (brushList.includes(toolName)) {
      setToolbarLastActiveBrush(toolName);
    }

    if (shapeList.includes(toolName)) {
      setToolbarLastActiveFigure(toolName);
    }

    if (penVariantList.includes(toolName)) {
      setLastActivePen(toolName);
    }

    if (arrowVariantList.includes(toolName)) {
      setLastActiveArrow(toolName);
    }
  };

  const moveFigureToTop = (figureId) => {
    setAllFigures(figures => {
      const target = figures.find(figure => figure.id === figureId);
      if (!target) return figures;

      const others = figures.filter(figure => figure.id !== figureId);

      return [...others, target];
    });
  };

  const getFigureAtMousePosition = (x, y) => {
    return allFigures.findLast((figure) => isOnFigure(x, y, figure))
  };

  const getDotNameAtMousePosition = (x, y) => {
    const activeFigure = findActiveFigure()

    return getDotNameOnFigure(x, y, activeFigure)
  }

  const setActiveHoveredDotName = (hoveredDotName) => {
    setActiveFigureInfo(prev => {
      if (!prev) return prev;
      if (prev.hoveredDotName === hoveredDotName) return prev;

      return { ...prev, hoveredDotName };
    });
  }

  const getResizeCursorByFigure = (figure, resizingDotName) => {
    if (['line', 'dashed_line', 'arrow', 'flat_arrow', 'number_line'].includes(figure.type)) {
      return 'pointer';
    }

    if (['rectangle', 'square', 'oval', 'circle', 'triangle', 'table'].includes(figure.type)) {
      const [pointA, pointB] = figure.points;
      const cornersByDotName = {
        pointA,
        pointB,
        pointC: [pointA[0], pointB[1]],
        pointD: [pointB[0], pointA[1]],
      };

      const activeCorner = cornersByDotName[resizingDotName];
      const minX = Math.min(pointA[0], pointB[0]);
      const minY = Math.min(pointA[1], pointB[1]);
      const isLeft = activeCorner[0] === minX;
      const isTop = activeCorner[1] === minY;

      const isPrimaryDiagonal = isLeft === isTop; // top-left (true,true), bottom-right (false,false)

      return isPrimaryDiagonal ? 'nwse-resize' : 'nesw-resize';
    }

    if (figure.type === 'text') {
      if (['pointAScale', 'pointBScale'].includes(resizingDotName)) return 'nwse-resize';
      if (['pointCScale', 'pointDScale'].includes(resizingDotName)) return 'nesw-resize';
    }

    return 'crosshair';
  }

  const setMouseCursor = (x, y) => {
    if (activeFigureInfo) {
      const activeFigure = findActiveFigure()
      const resizingDotName = getDotNameAtMousePosition(x, y);

      if (resizingDotName) {
        setActiveHoveredDotName(resizingDotName);
        setCursorType(getResizeCursorByFigure(activeFigure, resizingDotName));
        return
      }

      if (isOverFigure(x, y, activeFigure)) {
        setActiveHoveredDotName(null);
        setCursorType('move');
        return
      }

      setActiveHoveredDotName(null);
    }

    if ([...brushList, ...shapeList, 'text'].includes(activeTool)) {
      const selectedFigure = getFigureAtMousePosition(x, y);

      if (selectedFigure) {
        setCursorType('move');
        return
      }
    }

    setCursorType('crosshair');
  };
  const setMouseCursorThrottle = throttle(setMouseCursor, 100);

  const eraseOnIntersection = (eraserFigure) => (prevFigures) => {
    let hasChanges = false;

    const updatedFigures = prevFigures.map((figure) => {
      if (!figure.erased && areFiguresIntersecting(eraserFigure, figure)) {
        hasChanges = true;
        return { ...figure, erased: true };
      }
      return figure;
    });

    return hasChanges ? updatedFigures : prevFigures;
  };

  const eraseFiguresOnIntersection = (eraserFigure) => {
    setAllFigures(eraseOnIntersection(eraserFigure));
    setFadeFigures(eraseOnIntersection(eraserFigure));
  }

  const handleMouseDown = ({ x, y }) => {
    // Diactivate text editor
    if (textEditorContainer) {
      setTextEditorContainer({ ...textEditorContainer, isActive: false });
    }

    // With Active Figure
    if (activeFigureInfo) {
      // Click on dots of the active figure
      const activeFigure = findActiveFigure()
      const resizingDotName = getDotNameAtMousePosition(x, y);

      if (resizingDotName) {
        const resizingPointerOffset = getDotOffsetCoordinates(activeFigure, resizingDotName, x, y);

        setActiveFigureInfo(prev => {
          if (!prev) return prev;

          return {
            ...prev,
            resizing: true,
            resizingDotName: resizingDotName,
            resizingPointerOffset: resizingPointerOffset,
            hoveredDotName: null
          };
        });
        return;
      }

      if (isOverFigure(x, y, activeFigure)) {
        setActiveFigureInfo(prev => {
          if (!prev) return prev;

          return { ...prev, dragging: true, x, y, hoveredDotName: null };
        });

        return;
      }

      // Diactivate active figure
      setActiveFigureInfo(null);
    }

    // Click on the figure
    if ([...brushList, ...shapeList, 'text'].includes(activeTool)) {
      const selectedFigure = getFigureAtMousePosition(x, y);

      if (selectedFigure) {
        moveFigureToTop(selectedFigure.id)
        setActiveFigureInfo({ id: selectedFigure.id, dragging: true, x, y });
        return;
      }
    }

    if (activeTool === 'laser') {
      let laserFigure = {
        id: Date.now(),
        type: 'laser',
        widthIndex: activeWidthIndex,
        points: [[x, y]],
      };

      setLaserFigure([...allLaserFigures, laserFigure]);
      scheduleClearLaserTail(laserFigure.id)
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'eraser') {
      let eraserFigure = {
        id: Date.now(),
        type: 'eraser',
        widthIndex: activeWidthIndex,
        points: [[x, y]],
      };

      eraseFiguresOnIntersection(eraserFigure);
      setEraserFigure([...allEraserFigures, eraserFigure]);
      scheduleClearEraserTail(eraserFigure.id)
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'text') {
      if (!textEditorContainer) {
        const newTextEditor = {
          id: Date.now(),
          isActive: true,
          startAt: [x, y],
          colorIndex: activeColorIndex,
          widthIndex: activeWidthIndex,
          rainbowColorDeg: rainbowColorDeg,
          text: '',
          scale: 1,
          bold: false,
        };

        setTextEditorContainer(newTextEditor);
      }

      return;
    }

    let newFigure = {
      id: Date.now(),
      type: activeTool,
      colorIndex: activeColorIndex,
      widthIndex: activeWidthIndex,
      points: [[x, y]],
      rainbowColorDeg: rainbowColorDeg,
      ratio: 1,
      brushSize: brushList.includes(activeTool) ? brushSize : undefined,
      rows: activeTool === 'table' ? tableRows : undefined,
      columns: activeTool === 'table' ? tableColumns : undefined,
      minimum: activeTool === 'number_line' ? numberLineMin : undefined,
      maximum: activeTool === 'number_line' ? numberLineMax : undefined,
      dashSize: activeTool === 'dashed_line' ? dashedLineDashSize : undefined,
      dashSpacing: activeTool === 'dashed_line' ? dashedLineSpacing : undefined,
    };

    if (shapeList.includes(newFigure.type)) {
      newFigure.points.push([x, y]);
    }

    if (activeTool === 'fadepen') {
      setIsFadeDrawing(true);
      setFadeFigures(prevFadeFigures => [...prevFadeFigures, newFigure]);
      setIsDrawing(true);
      return;
    }

    setAllFigures(prevAllFigures => [...prevAllFigures, newFigure]);
    setIsDrawing(true);
  };

  const handleMouseMove = ({ x, y }) => {
    if (isActiveFigureMoving()) {
      const activeFigure = findActiveFigure()

      if (activeFigureInfo.dragging) {
        dragFigure(activeFigure, { x: activeFigureInfo.x, y: activeFigureInfo.y }, { x, y })
      }

      if (activeFigureInfo.resizing) {
        resizeFigure(
          activeFigure,
          activeFigureInfo,
          { x, y, isShiftPressed }
        )
      }

      setActiveFigureInfo(prev => ({ ...prev, x, y }));
      setAllFigures([...allFigures]);
      return
    }

    if (isDrawing) {
      if (activeTool === 'laser') {
        const currentLaser = allLaserFigures[allLaserFigures.length - 1];

        currentLaser.points = [...currentLaser.points, [x, y]];

        setLaserFigure([...allLaserFigures]);
        scheduleClearLaserTail(currentLaser.id)
        return;
      }

      if (activeTool === 'eraser') {
        const currentEraser = allEraserFigures[allEraserFigures.length - 1];

        currentEraser.points = [...currentEraser.points, [x, y]];

        eraseFiguresOnIntersection(currentEraser);
        setEraserFigure([...allEraserFigures]);
        scheduleClearEraserTail(currentEraser.id)
        return;
      }

      if (activeTool === 'fadepen') {
        const currentFigure = allFadeFigures[allFadeFigures.length - 1];

        currentFigure.points = [...currentFigure.points, [x, y]];

        setFadeFigures([...allFadeFigures]);
        return;
      }

      if (['pen', 'highlighter'].includes(activeTool)) {
        const currentFigure = allFigures[allFigures.length - 1];

        currentFigure.points = [...currentFigure.points, [x, y]];

        setAllFigures([...allFigures]);
        return
      }

      if (shapeList.includes(activeTool)) {
        const currentFigure = allFigures[allFigures.length - 1];

        if (currentFigure.type === 'number_line') {
          const startPoint = currentFigure.points[0];
          const deltaX = x - startPoint[0];
          const deltaY = y - startPoint[1];

          if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            y = startPoint[1];
          } else {
            x = startPoint[0];
          }
        }

        if (isShiftPressed) {
          if (['line', 'dashed_line', 'arrow', 'flat_arrow'].includes(currentFigure.type)) {
            const startPoint = currentFigure.points[0];

            const result = applySoftSnap(startPoint[0], startPoint[1], x, y);
            x = result.x;
            y = result.y;
          }

          if (['rectangle', 'oval'].includes(currentFigure.type)) {
            const startPoint = currentFigure.points[0];

            const result = applyAspectRatioLock(startPoint[0], startPoint[1], x, y, currentFigure.ratio);
            x = result.x;
            y = result.y;
          }
        }

        if (['square', 'circle'].includes(currentFigure.type)) {
          const startPoint = currentFigure.points[0];
          const result = applyAspectRatioLock(startPoint[0], startPoint[1], x, y, 1);

          x = result.x;
          y = result.y;
        }

        currentFigure.points[1] = [x, y];

        setAllFigures([...allFigures]);
        return
      }
    }

    setMouseCursorThrottle(x, y)
  };

  const handleMouseUp = ({ x, y }) => {
    if (isDrawing) {
      const upPoint = [x, y];

      if (activeTool === 'laser') {
        const currentLaser = allLaserFigures[allLaserFigures.length - 1];
        const amountOfPoints = currentLaser.points.length;

        let laserDistance = 0;
        if (amountOfPoints > 0) {
          laserDistance = distanceBetweenPoints(currentLaser.points[0], upPoint);
        }

        if (laserDistance < minObjectDistance && amountOfPoints < 10) {
          const ripple = {
            id: Date.now(),
            points: upPoint,
          };

          setRippleEffects([...rippleEffects, ripple]);

          currentLaser.points = [];
          setLaserFigure([...allLaserFigures]);
        }
      }

      if (activeTool === 'eraser') {
        const figuresToRemove = allFigures.filter(figure => figure.erased).map(figure => ({ ...figure, erased: false }));
        const fadeFiguresToRemove = allFadeFigures.filter(figure => figure.erased).map(figure => ({ ...figure, erased: false }));

        if (figuresToRemove.length > 0) {
          setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'remove', figures: figuresToRemove }]);
          setRedoStackFigures([]);

          setAllFigures(allFigures.filter(figure => !figure.erased));
        }

        if (fadeFiguresToRemove.length > 0) {
          setFadeFigures(allFadeFigures.filter(figure => !figure.erased));
        }
      }

      if (activeTool === 'highlighter') {
        const currentFigure = allFigures.at(-1);

        setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'add', figures: [currentFigure] }]);
        setRedoStackFigures([]);
      }

      if (activeTool === 'fadepen') {
        const currentFigure = allFadeFigures.at(-1);

        if (penSmoothing && !colorList[currentFigure.colorIndex].isRainbow) {
          currentFigure.points = [...filterClosePoints(currentFigure.points, currentFigure.widthIndex)];
        }

        setFadeFigures([...allFadeFigures]);
        setIsFadeDrawing(false);
      }

      if (activeTool === 'pen') {
        const currentFigure = allFigures.at(-1);

        if (penSmoothing && !colorList[currentFigure.colorIndex].isRainbow) {
          currentFigure.points = [...filterClosePoints(currentFigure.points, currentFigure.widthIndex)];
        }

        setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'add', figures: [currentFigure] }]);
        setRedoStackFigures([]);

        setAllFigures([...allFigures]);
      }

      if (shapeList.includes(activeTool)) {
        const currentFigure = allFigures.at(-1);
        const shapeDistance = distanceBetweenPoints(currentFigure.points[0], upPoint);

        if (['rectangle', 'square', 'oval', 'circle'].includes(currentFigure.type)) {
          currentFigure.ratio = calculateAspectRatio(currentFigure);
        }

        if (shapeDistance < minObjectDistance) {
          setAllFigures(allFigures => allFigures.slice(0, -1));
        } else {
          setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'add', figures: [currentFigure] }]);
          setRedoStackFigures([]);
          setAllFigures([...allFigures]);
        }
      }
    }

    if (isActiveFigureMoving()) {
      const activeFigure = findActiveFigure()

      if (activeFigureInfo.resizing) {
        if (['rectangle', 'square', 'oval', 'circle'].includes(activeFigure.type)) {
          activeFigure.ratio = calculateAspectRatio(activeFigure);

          setAllFigures([...allFigures]);
        }
      }

      setActiveFigureInfo({ id: activeFigureInfo.id });
    }

    setIsDrawing(false);
  };

  const handleDoubleClick = ({ x, y }) => {
    if (activeFigureInfo) {
      const activeFigure = findActiveFigure()

      if (activeFigure.type === 'text') {
        activateTextEditor(activeFigure);
      }
    }
  };

  const handleMousePosition = (event) => {
    setMouseCoordinates(getMouseCoordinates(event));
  }

  const handleContextMenu = (event) => {
    event.preventDefault();

    if (clearDrawingsOnHide) {
      handleReset();
    }

    invokePointerMode();
  }

  const handleEnablePointerMode = () => {
    if (clearDrawingsOnHide) {
      handleReset();
    }

    invokePointerMode();
  };

  const handleCloseToolBar = () => {
    invokeCloseApp();
  }

  const invokeOpenSettings = () => {
    console.log('Renderer -> Main: Invoke Open Settings');

    window.electronAPI.invokeOpenSettings();
  }

  const invokeMakeScreenshot = () => {
    console.log('Renderer -> Main: Invoke Make Screenshot');

    window.electronAPI.invokeMakeScreenshot();
  }

  const invokeOpenNotification = (info) => {
    console.log('Renderer -> Main: Invoke Open Notification');

    window.electronAPI.invokeOpenNotification(info);
  }

  const invokePointerMode = () => {
    console.log('Renderer -> Main: Invoke Pointer Mode');

    window.electronAPI.invokePointerMode({
      x: window.screenX + toolbarPosition.x,
      y: window.screenY + toolbarPosition.y + toolbarWindowContentOffsetY,
    });
  }

  const handleToolbarPositionChangeComplete = (position) => {
    window.electronAPI.invokeSetToolbarPosition({
      x: window.screenX + position.x,
      y: window.screenY + position.y + toolbarWindowContentOffsetY,
    });
  };

  const invokeCloseApp = () => {
    console.log('Renderer -> Main: Invoke Close App');

    window.electronAPI.invokeCloseApp();
  }

  const handleReset = () => {
    console.log('Main -> Renderer: Handle Reset');

    setIsDrawing(false);
    setActiveFigureInfo(null);
    setAllFigures([]);
    setFadeFigures([]);
    resetFadeTimer();
    setLaserFigure([]);
    setEraserFigure([]);
    setRippleEffects([]);
    setTextEditorContainer(null);
    setUndoStackFigures([]);
    setRedoStackFigures([]);
    setClipboardFigure(null);
  };

  const handleToggleToolbar = () => {
    console.log('Main -> Renderer: Toggle Toolbar');

    setShowToolbar((prevShowToolbar) => !prevShowToolbar);
  };

  const handleToggleWhiteboard = () => {
    console.log('Main -> Renderer: Toggle Whiteboard');

    setShowWhiteboard((prevShowWhiteboard) => !prevShowWhiteboard);
  };

  const handleRefreshSettings = (_, newSettings) => {
    console.log('Main -> Renderer: Refresh Settings');

    setColorList(createApplicationColorList(newSettings.tool_bar_color_palette));
    setWhiteboardTheme(newSettings.whiteboard_color);
    setWhiteboardLayout(newSettings.whiteboard_layout);
    setWhiteboardOpacity(newSettings.whiteboard_opacity);
    setWhiteboardPatternStyle(newSettings.whiteboard_style);
    setWhiteboardSpacing(newSettings.whiteboard_spacing);
    setShowDrawingBorder(newSettings.show_drawing_border);
    setShowCuteCursor(newSettings.show_cute_cursor);
    setPenSmoothing(newSettings.pen_smoothing);
    setBrushSize(newSettings.tool_bar_brush_size);
    setTableRows(newSettings.table_rows);
    setTableColumns(newSettings.table_columns);
    setNumberLineMin(newSettings.number_line_min);
    setNumberLineMax(newSettings.number_line_max);
    setDashedLineDashSize(newSettings.dashed_line_dash_size);
    setDashedLineSpacing(newSettings.dashed_line_spacing);
    setClearDrawingsOnHide(newSettings.clear_drawings_on_hide);
    setMainColorIndex(newSettings.swap_colors_indexes[0]);
    setSecondaryColorIndex(newSettings.swap_colors_indexes[1]);
  };

  const reportDrawToolbarGeometry = (token) => {
    const report = () => {
      afterTwoAnimationFrames(() => {
        window.electronAPI.notifyDrawToolbarGeometryReady(token, {
          screen_x: window.screenX,
          screen_y: window.screenY,
          inner_width: window.innerWidth,
          inner_height: window.innerHeight,
        });
      });
    };

    if (document.visibilityState === 'visible') {
      report();
      return;
    }

    document.addEventListener('visibilitychange', function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      document.removeEventListener('visibilitychange', onVisibilityChange);
      report();
    });
  };

  const handlePrepareDrawToolbar = (_, token) => {
    console.log('Main -> Renderer: Prepare Draw Toolbar');

    const toolbarElement = document.getElementById('toolbar');
    if (toolbarElement) {
      toolbarElement.style.visibility = 'hidden';
    }

    setToolbarPositionReady(false);
    reportDrawToolbarGeometry(token);
  };

  const handleApplyDrawToolbarPosition = (_, token, positionInfo) => {
    console.log('Main -> Renderer: Apply Draw Toolbar Position');

    setToolbarPosition({
      x: positionInfo.screen_x - window.screenX,
      y: positionInfo.screen_y - window.screenY - (positionInfo.window_content_offset_y || 0),
    });
    setToolbarPositionReady(true);

    afterTwoAnimationFrames(() => {
      const toolbarElement = document.getElementById('toolbar');
      if (toolbarElement) {
        toolbarElement.style.visibility = 'visible';
      }

      const toolbarBounds = toolbarElement?.getBoundingClientRect();

      requestAnimationFrame(() => {
        window.electronAPI.notifyDrawToolbarPositionApplied(token, {
          screen_x: window.screenX,
          screen_y: window.screenY,
          toolbar_x: toolbarBounds?.x,
          toolbar_y: toolbarBounds?.y,
        });
      });
    });
  };

  const handleUpdateToolbarPosition = (_, newSettings) => {
    console.log('Main -> Renderer: Update Toolbar Position');

    setToolbarPosition({
      x: newSettings.tool_bar_screen_x - window.screenX,
      y: newSettings.tool_bar_screen_y - window.screenY - (newSettings.tool_bar_window_content_offset_y || 0),
    });
  };

  const handleShowNotification = (_, data) => {
    console.log('Main -> Renderer: Show Notification');

    setToastInfo({
      title: data.title,
      body: data.body,
      button_label: data.button_label,
      button_action: data.button_action,
      button_data: data.button_data
    });
  };

  const invokeSetSettings = (settings) => {
    console.log('Renderer -> Main: Invoke Set Settings');

    window.electronAPI.invokeSetSettings(settings);
  };

  const handleChangeWhiteboardTheme = (theme) => {
    setWhiteboardTheme(theme);
    invokeSetSettings({ whiteboard_color: theme });
  };

  const handleSetWhiteboardMode = (theme) => {
    const enabled = theme !== null;

    setShowWhiteboard(enabled);
    if (enabled) {
      setWhiteboardTheme(theme);
    }

    invokeSetSettings({
      show_whiteboard: enabled,
      ...(enabled ? { whiteboard_color: theme } : {}),
    });
  };

  const handleChangeWhiteboardOpacity = (opacity) => {
    setWhiteboardOpacity(opacity);
    invokeSetSettings({ whiteboard_opacity: opacity });
  };

  const handleChangeWhiteboardPatternStyle = (style) => {
    setWhiteboardPatternStyle(style);
    invokeSetSettings({ whiteboard_style: style });
  };

  const handleChangeWhiteboardSpacing = (spacing) => {
    setWhiteboardSpacing(spacing);
    invokeSetSettings({ whiteboard_spacing: spacing });
  };

  const handleChangeWhiteboardLayout = (layout, saveToStore = false) => {
    setWhiteboardLayout(layout);

    if (saveToStore) {
      invokeSetSettings({ whiteboard_layout: layout });
    }
  };

  const handleToastClicked = () => {
    invokeOpenNotification({
      action: toastInfo.button_action,
      data: toastInfo.button_data,
    });

    setToastInfo(null);
  };

  const handleToggleTextBold = () => {
    setTextEditorContainer(prev => prev ? { ...prev, bold: !prev.bold } : prev);
  };

  const handleTextEditorBlur = (text) => {
    const cleanedText = text.replace(/[\s\u200B\u200C\u200D\uFEFF]+$/g, ''); // прибираємо сміття з кінця

    if (cleanedText === '') {
      setTextEditorContainer(null);
      return;
    }

    const [width, height] = calculateCanvasTextWidth(cleanedText, textEditorContainer.widthIndex, textEditorContainer.bold);

    const textFigure = {
      id: Date.now(),
      type: 'text',
      colorIndex: textEditorContainer.colorIndex,
      widthIndex: textEditorContainer.widthIndex,
      rainbowColorDeg: textEditorContainer.rainbowColorDeg,
      text: cleanedText,
      points: [textEditorContainer.startAt],
      scale: textEditorContainer.scale,
      width: width,
      height: height,
      bold: textEditorContainer.bold,
    };

    setAllFigures([...allFigures, textFigure]);
    setTextEditorContainer(null);

    setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'add', figures: [textFigure] }]);
    setRedoStackFigures([]);
  };

  const activateTextEditor = (pickedFigure) => {
    const newTextEditor = {
      isActive: true,
      startAt: pickedFigure.points[0],
      colorIndex: pickedFigure.colorIndex,
      widthIndex: pickedFigure.widthIndex,
      rainbowColorDeg: pickedFigure.rainbowColorDeg,
      text: pickedFigure.text,
      scale: pickedFigure.scale,
      bold: pickedFigure.bold ?? false,
    };

    setTextEditorContainer(newTextEditor);
    setActiveFigureInfo(null);
    setAllFigures(allFigures.filter(figure => figure.id !== pickedFigure.id));

    setUndoStackFigures(prevUndoStack => [...prevUndoStack, { type: 'remove', figures: [pickedFigure] }]);
    setRedoStackFigures([]);
  }

  const manipulation = (isDrawing || isActiveFigureMoving()) ? "manipulation_mode" : "";

  return (
    <div id="root_wrapper" className={manipulation} onPointerMove={handleMousePosition} onContextMenu={handleContextMenu}>

      {
        showWhiteboard &&
        <Whiteboard
          theme={whiteboardTheme}
          layout={whiteboardLayout}
          opacity={whiteboardOpacity}
          patternStyle={whiteboardPatternStyle}
          spacing={whiteboardSpacing}
          onChangeTheme={handleChangeWhiteboardTheme}
          onChangeOpacity={handleChangeWhiteboardOpacity}
          onChangePatternStyle={handleChangeWhiteboardPatternStyle}
          onChangeSpacing={handleChangeWhiteboardSpacing}
          onChangeLayout={handleChangeWhiteboardLayout}
        />
      }

      {
        showDrawingBorder &&
        <div id="zone_borders"></div>
      }

      {
        toastInfo &&
          <Toast
            info={toastInfo}
            handleToastClicked={handleToastClicked}
          />
      }

      {
        rippleEffects &&
          <RippleEffect
            rippleEffects={rippleEffects}
          />
      }

      {
        textEditorContainer &&
          <TextEditor
            textEditorContainer={textEditorContainer}
            handleTextEditorBlur={handleTextEditorBlur}
            handleToggleTextBold={handleToggleTextBold}
            colorList={colorList}
          />
      }

      {
        showCuteCursor &&
          <CuteCursor
            mouseCoordinates={mouseCoordinates}
            activeColorIndex={activeColorIndex}
            activeWidthIndex={activeWidthIndex}
            activeTool={activeTool}
            brushSize={brushSize}
            Icons={Icons}
            colorList={colorList}
          />
      }

      <DrawDesk
        allFigures={allFigures}
        allFadeFigures={allFadeFigures}
        allLaserFigures={allLaserFigures}
        allEraserFigures={allEraserFigures}
        fadeOpacity={fadeOpacity}
        activeFigureInfo={activeFigureInfo}
        cursorType={cursorType}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        handleDoubleClick={handleDoubleClick}
        updateRainbowColorDeg={updateRainbowColorDeg}
        activeTool={activeTool}
        handleChangeTool={handleChangeTool}
        colorList={colorList}
      />

      {
        showToolbar && toolbarPositionReady &&
          <ToolBar
            position={toolbarPosition}
            setPosition={setToolbarPosition}
            handlePositionChangeComplete={handleToolbarPositionChangeComplete}
            toolbarSlide={toolbarSlide}
            setToolbarSlide={setToolbarSlide}
            isCollapsed={toolbarCollapsed}
            setIsCollapsed={setToolbarCollapsed}
            lastActiveBrush={toolbarLastActiveBrush}
            lastActiveFigure={toolbarLastActiveFigure}
            activeTool={activeTool}
            activeColorIndex={activeColorIndex}
            activeWidthIndex={activeWidthIndex}
            handleCloseToolBar={handleCloseToolBar}
            handleChangeColor={handleChangeColor}
            handleChangeCustomColor={handleChangeCustomColor}
            handleChangeWidth={handleChangeWidth}
            handleChangeBrushSize={handleChangeBrushSize}
            handleChangeTableDimensions={handleChangeTableDimensions}
            handleChangeNumberLineRange={handleChangeNumberLineRange}
            handleChangeDashedLineStyle={handleChangeDashedLineStyle}
            handleChangeTool={handleChangeTool}
            handleClearDesk={handleReset}
            handleSetWhiteboardMode={handleSetWhiteboardMode}
            handleSetWhiteboardPatternStyle={handleChangeWhiteboardPatternStyle}
            handleMakeScreenshot={invokeMakeScreenshot}
            handleEnablePointerMode={handleEnablePointerMode}
            showWhiteboard={showWhiteboard}
            whiteboardTheme={whiteboardTheme}
            whiteboardPatternStyle={whiteboardPatternStyle}
            brushSize={brushSize}
            tableRows={tableRows}
            tableColumns={tableColumns}
            numberLineMin={numberLineMin}
            numberLineMax={numberLineMax}
            dashedLineDashSize={dashedLineDashSize}
            dashedLineSpacing={dashedLineSpacing}
            Icons={Icons}
            colorList={colorList}
          />
      }
    </div>
  );
};

export default Application;
