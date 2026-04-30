export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy: number;
}

export function getCurrentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.message || "Unable to fetch location")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

// Static OpenStreetMap tile preview — no API key required.
// We approximate map preview with a 300x180 image from OSM static (via staticmap.openstreetmap.de mirror)
export function staticMapUrl(p: GeoPoint, w = 600, h = 320, zoom = 16): string {
  // Using a public static-map service (no key); falls back gracefully.
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${p.lat},${p.lng}&zoom=${zoom}&size=${w}x${h}&markers=${p.lat},${p.lng},red-pushpin`;
}

export function osmLink(p: GeoPoint): string {
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
}
