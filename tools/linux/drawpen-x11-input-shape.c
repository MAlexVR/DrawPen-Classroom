#include <X11/Xlib.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

/* libXext headers are not required at runtime on Fedora. */
extern void XShapeCombineRectangles(
  Display *display,
  Window destination,
  int destination_kind,
  int x_offset,
  int y_offset,
  XRectangle *rectangles,
  int rectangle_count,
  int operation,
  int ordering
);

enum {
  SHAPE_INPUT = 2,
  SHAPE_SET = 0,
};

static Window find_top_level(Display *display, Window window, Window root) {
  Window top_level = window;
  Window current = window;

  while (current != root) {
    Window query_root = None;
    Window parent = None;
    Window *children = NULL;
    unsigned int child_count = 0;

    if (!XQueryTree(display, current, &query_root, &parent, &children, &child_count)) {
      if (children) XFree(children);
      break;
    }

    if (children) XFree(children);
    if (parent == None || parent == root) break;

    top_level = parent;
    current = parent;
  }

  return top_level;
}

int main(int argc, char **argv) {
  if (argc != 2) return 2;

  errno = 0;
  char *end = NULL;
  const Window window = (Window)strtoul(argv[1], &end, 0);
  if (errno || end == argv[1] || *end != '\0') return 3;

  Display *display = XOpenDisplay(NULL);
  if (!display) return 4;

  const Window root = DefaultRootWindow(display);

  int x;
  int y;
  unsigned int width;
  unsigned int height;

  while (scanf("%d %d %u %u", &x, &y, &width, &height) == 4) {
    /*
     * COSMIC/Xwayland may create or replace Chromium's compositor frame
     * after the helper starts, so rediscover it every time the shape moves.
     */
    const Window top_level = find_top_level(display, window, root);
    int client_offset_x = 0;
    int client_offset_y = 0;
    Window translated_child = None;

    if (top_level != window) {
      XTranslateCoordinates(
        display,
        window,
        top_level,
        0,
        0,
        &client_offset_x,
        &client_offset_y,
        &translated_child
      );
    }

    XRectangle rectangle = {
      .x = (short)x,
      .y = (short)y,
      .width = (unsigned short)width,
      .height = (unsigned short)height,
    };

    XShapeCombineRectangles(
      display,
      window,
      SHAPE_INPUT,
      0,
      0,
      &rectangle,
      1,
      SHAPE_SET,
      Unsorted
    );

    if (top_level != window) {
      XRectangle frame_rectangle = {
        .x = (short)(x + client_offset_x),
        .y = (short)(y + client_offset_y),
        .width = (unsigned short)width,
        .height = (unsigned short)height,
      };

      XShapeCombineRectangles(
        display,
        top_level,
        SHAPE_INPUT,
        0,
        0,
        &frame_rectangle,
        1,
        SHAPE_SET,
        Unsorted
      );
    }

    XFlush(display);
  }

  XCloseDisplay(display);
  return 0;
}
