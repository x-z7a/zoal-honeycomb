export const hasXPlane = () => typeof (globalThis as any).XPlane?.dataref?.getTypes === 'function';

export const readDatarefValue = (name: string, index?: number): string => {
  try {
    if (!hasXPlane()) return '—';
    const types = (globalThis as any).XPlane.dataref.getTypes(name);
    if (!types) return 'N/A';
    if (types.float) return String((globalThis as any).XPlane.dataref.getFloat(name));
    if (types.int) return String((globalThis as any).XPlane.dataref.getInt(name));
    if (types.double) return String((globalThis as any).XPlane.dataref.getDouble(name));
    if (types.floatArray) {
      const arr = (globalThis as any).XPlane.dataref.getFloatArray(name) || [];
      const idx = typeof index === 'number' ? index : 0;
      return arr.length ? String(arr[idx] ?? arr[0]) : '[]';
    }
    if (types.intArray) {
      const arr = (globalThis as any).XPlane.dataref.getIntArray(name) || [];
      const idx = typeof index === 'number' ? index : 0;
      return arr.length ? String(arr[idx] ?? arr[0]) : '[]';
    }
    if (types.data) {
      const str = (globalThis as any).XPlane.dataref.getData(name);
      return str ? `"${str}"` : '""';
    }
  } catch {
    return 'Err';
  }
  return 'N/A';
};
