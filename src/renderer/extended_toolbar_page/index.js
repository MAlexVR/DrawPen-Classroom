console.log('[DRAWPEN]: Extended toolbar page loading...');

const toolbar = document.getElementById('toolbar');
const closeAppButton = toolbar.querySelector('.toolbar__close');
const switchToDrawButtons = toolbar.querySelectorAll('.toolbar__main-button button, .toolbar__slider');
const dragHandles = toolbar.querySelectorAll('.toolbar__draglines');
const toolbarWindowMargin = 10;
const toolbarWindowWidth = 113;
const toolbarWindowHeight = 86;
let containedToolbarEnabled = false;
let containedDrag = null;
// Do not expose COSMIC's provisional placement during the first native map.
document.documentElement.style.visibility = 'hidden';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

function setContainedToolbarPosition(x, y) {
  const maxX = Math.max(toolbarWindowMargin, window.innerWidth - (toolbarWindowWidth - toolbarWindowMargin));
  const maxY = Math.max(toolbarWindowMargin, window.innerHeight - (toolbarWindowHeight - toolbarWindowMargin));
  const position = {
    x: Math.round(clamp(x, toolbarWindowMargin, maxX)),
    y: Math.round(clamp(y, toolbarWindowMargin, maxY)),
  };

  toolbar.style.left = `${position.x}px`;
  toolbar.style.top = `${position.y}px`;
  return position;
}

window.electronAPI.onConfigureContainedToolbar(configuration => {
  containedToolbarEnabled = Boolean(configuration?.enabled);
  document.documentElement.classList.toggle('contained-toolbar', containedToolbarEnabled);

  if (containedToolbarEnabled) {
    setContainedToolbarPosition(configuration.x, configuration.y);
  }
});

dragHandles.forEach(handle => {
  handle.addEventListener('pointerdown', event => {
    if (!containedToolbarEnabled || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    containedDrag = {
      pointerId: event.pointerId,
      handle,
      offsetX: event.clientX - toolbar.offsetLeft,
      offsetY: event.clientY - toolbar.offsetTop,
    };
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', event => {
    if (!containedDrag || containedDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    const position = setContainedToolbarPosition(
      event.clientX - containedDrag.offsetX,
      event.clientY - containedDrag.offsetY,
    );
    window.electronAPI.sendContainedToolbarPosition(position, false);
  });

  const finishContainedDrag = event => {
    if (!containedDrag || containedDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    const { handle: capturedHandle, pointerId } = containedDrag;
    containedDrag = null;

    if (capturedHandle.hasPointerCapture(pointerId)) {
      capturedHandle.releasePointerCapture(pointerId);
    }

    window.electronAPI.sendContainedToolbarPosition({
      x: toolbar.offsetLeft,
      y: toolbar.offsetTop,
    }, true);
  };

  handle.addEventListener('pointerup', finishContainedDrag);
  handle.addEventListener('pointercancel', finishContainedDrag);
});

window.electronAPI.onSetConcealed((concealed, token) => {
  document.documentElement.style.visibility = concealed ? 'hidden' : 'visible';

  requestAnimationFrame(() => {
    if (token !== undefined && token !== null) {
      window.electronAPI.notifyToolbarConcealed(token, concealed);
    }
  });
});

closeAppButton.addEventListener('click', () => {
  window.electronAPI.invokeCloseApp();
});

switchToDrawButtons.forEach(button => {
  button.addEventListener('click', () => {
    window.electronAPI.invokeDrawMode();
  });
});
