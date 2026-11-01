import { describe, expect, it } from "vitest";
import { calibrationError, distance, distanceToPolyline, lengthLabel, measureRoute, metersPerPixel, polylineLength } from "./geometry";
import { clampView, fitView, imageToScreen, panBy, pinchView, screenToImage, zoomAt } from "./viewport";

describe("geometria planu", () => {
  it("długość odcinka i polilinii to suma odcinków", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(polylineLength([0, 0, 3, 4, 3, 10])).toBe(11);
    expect(polylineLength([5, 5])).toBe(0);
  });

  it("odległość punktu od trasy (do zaznaczania stuknięciem)", () => {
    expect(distanceToPolyline({ x: 5, y: 3 }, [0, 0, 10, 0])).toBe(3);
    expect(distanceToPolyline({ x: 13, y: 4 }, [0, 0, 10, 0])).toBe(5);
  });

  it("kalibracja: metersPerPixel = znana długość / odległość w pikselach", () => {
    const cal = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, meters: 5, at: 1 };
    expect(metersPerPixel(cal)).toBe(0.025);
    expect(metersPerPixel(null)).toBeNull();
    expect(calibrationError({ x: 0, y: 0 }, { x: 5, y: 0 }, 1)).toBe("short");
    expect(calibrationError({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toBe("meters");
    expect(calibrationError({ x: 0, y: 0 }, { x: 100, y: 0 }, 2.5)).toBeNull();
  });

  it("bez skali długość zostaje w pikselach i nigdy nie jest podana w metrach", () => {
    const route = { pts: [0, 0, 300, 400], verified: true };
    const noScale = measureRoute(route, null);
    expect(noScale).toEqual({ lengthPixels: 500, lengthMeters: null, status: "noScale" });
    expect(lengthLabel(noScale)).toBe("500 px (bez skali)");
    const scaled = measureRoute(route, 0.01);
    expect(scaled.status).toBe("confirmed");
    expect(lengthLabel(scaled)).toBe("5,00 m");
    expect(measureRoute({ ...route, estimate: true }, 0.01).status).toBe("estimated");
    expect(measureRoute({ ...route, verified: false }, 0.01).status).toBe("estimated");
  });
});

describe("widok planu (zoom, przesunięcie)", () => {
  it("przeliczenie ekran ↔ obraz jest odwracalne po zoomie i przesunięciu", () => {
    const v = panBy(zoomAt({ scale: 1, tx: 0, ty: 0 }, 2.5, { x: 100, y: 50 }), 30, -20);
    const p = { x: 123.4, y: 56.7 };
    const back = screenToImage(v, imageToScreen(v, p));
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it("zoom wokół punktu zostawia ten punkt obrazu pod kursorem", () => {
    const v = { scale: 0.5, tx: 40, ty: 10 };
    const at = { x: 200, y: 150 };
    const under = screenToImage(v, at);
    const z = zoomAt(v, 3, at);
    const after = screenToImage(z, at);
    expect(after.x).toBeCloseTo(under.x, 9);
    expect(after.y).toBeCloseTo(under.y, 9);
  });

  it("dopasowanie mieści cały obraz i go centruje; zoom ma granice", () => {
    const v = fitView(4000, 2000, 1000, 600, 0);
    expect(v.scale).toBe(0.25);
    expect(v.ty).toBe(50);
    expect(zoomAt(v, 1e6, { x: 0, y: 0 }).scale).toBe(8);
  });

  it("szczypanie: rozsunięcie palców dwa razy = dwa razy większa skala", () => {
    const v = { scale: 1, tx: 0, ty: 0 };
    const z = pinchView(v, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 50, y: 100 }, { x: 250, y: 100 }]);
    expect(z.scale).toBeCloseTo(2, 9);
  });

  it("obrazu nie da się wyprowadzić całkiem poza okno", () => {
    const v = clampView({ scale: 1, tx: -5000, ty: 9000 }, 1000, 1000, 800, 600, 48);
    expect(v.tx).toBe(48 - 1000);
    expect(v.ty).toBe(600 - 48);
  });
});
