// Tauri only resizes undecorated windows from the edges of a window's content webview, and
// the `unstable` feature (needed for browser tabs) makes every webview a child webview.

use gtk::gdk::{Cursor, CursorType, EventMask, WindowEdge};
use gtk::glib::Propagation;
use gtk::prelude::*;

const INSET: i32 = 5;

fn resizable_window(view: &gtk::Widget) -> Option<gtk::Window> {
    let window = view.toplevel()?.downcast::<gtk::Window>().ok()?;
    (!window.is_decorated() && window.is_resizable() && !window.is_maximized()).then_some(window)
}

fn edge_at(view: &gtk::Widget, (x, y): (f64, f64)) -> Option<WindowEdge> {
    let inset = f64::from(view.scale_factor() * INSET);
    let left = x < inset;
    let right = x >= f64::from(view.allocated_width()) - inset;
    let top = y < inset;
    let bottom = y >= f64::from(view.allocated_height()) - inset;
    Some(match (left, right, top, bottom) {
        (true, _, true, _) => WindowEdge::NorthWest,
        (_, true, true, _) => WindowEdge::NorthEast,
        (true, _, _, true) => WindowEdge::SouthWest,
        (_, true, _, true) => WindowEdge::SouthEast,
        (true, ..) => WindowEdge::West,
        (_, true, ..) => WindowEdge::East,
        (_, _, true, _) => WindowEdge::North,
        (.., true) => WindowEdge::South,
        _ => return None,
    })
}

fn edge_cursor(edge: WindowEdge) -> CursorType {
    match edge {
        WindowEdge::NorthWest => CursorType::TopLeftCorner,
        WindowEdge::NorthEast => CursorType::TopRightCorner,
        WindowEdge::SouthWest => CursorType::BottomLeftCorner,
        WindowEdge::SouthEast => CursorType::BottomRightCorner,
        WindowEdge::West => CursorType::LeftSide,
        WindowEdge::East => CursorType::RightSide,
        WindowEdge::North => CursorType::TopSide,
        _ => CursorType::BottomSide,
    }
}

pub fn resize_from_edges(view: &gtk::Widget) {
    view.add_events(EventMask::POINTER_MOTION_MASK | EventMask::BUTTON_PRESS_MASK);
    view.connect_motion_notify_event(|view, event| {
        let Some(edge) = resizable_window(view).and_then(|_| edge_at(view, event.position())) else {
            return Propagation::Proceed;
        };
        if let Some(window) = view.window() {
            window.set_cursor(Cursor::for_display(&window.display(), edge_cursor(edge)).as_ref());
        }
        Propagation::Stop
    });
    view.connect_button_press_event(|view, event| {
        let edge = edge_at(view, event.position()).filter(|_| event.button() == 1);
        let Some((window, edge)) = resizable_window(view).zip(edge) else {
            return Propagation::Proceed;
        };
        let (x, y) = event.root();
        window.begin_resize_drag(edge, 1, x as i32, y as i32, event.time());
        Propagation::Stop
    });
}
