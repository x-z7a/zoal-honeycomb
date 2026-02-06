/**
 * SkyScript X-Plane API TypeScript Definitions
 * 
 * This file provides TypeScript type definitions for the X-Plane SDK
 * JavaScript bindings available in SkyScript applications.
 * 
 * Include this in your tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "typeRoots": ["./node_modules/@types", "../../docs/api/types"]
 *   }
 * }
 * 
 * @version 1.1.0
 * @license MIT
 */

declare global {
    /**
     * The XPlane global object provides access to X-Plane SDK functionality
     */
    const XPlane: XPlaneAPI;

    /**
     * The SkyScript global object provides app management, filesystem access,
     * path utilities, and app context information.
     */
    const SkyScript: SkyScriptAPI;
}

/**
 * Main X-Plane API interface
 */
interface XPlaneAPI {
    /**
     * DataRef access API for reading and writing simulator data
     */
    dataref: DataRefAPI;

    /**
     * Scenery API for loading objects, terrain probing, and magnetic variation
     */
    scenery: SceneryAPI;

    /**
     * Instance API for creating and managing object instances
     */
    instance: InstanceAPI;

    /**
     * Graphics API for coordinate conversions
     */
    graphics: GraphicsAPI;

    /**
     * HID API for USB Human Interface Device access
     */
    hid: HidAPI;
    /**
     * Utilities API for command management and miscellaneous helpers
     */
    utilities: UtilitiesAPI;
}

/**
 * DataRef type information returned by getTypes()
 */
interface DataRefTypes {
    /** DataRef supports integer access */
    int: boolean;
    /** DataRef supports float access */
    float: boolean;
    /** DataRef supports double access */
    double: boolean;
    /** DataRef supports integer array access */
    intArray: boolean;
    /** DataRef supports float array access */
    floatArray: boolean;
    /** DataRef supports byte/string data access */
    data: boolean;
}

/**
 * DataRef API for accessing X-Plane simulator data
 * 
 * DataRefs are the primary way to read and write data in X-Plane.
 * They provide access to cockpit instruments, aircraft position,
 * weather, and thousands of other simulation values.
 * 
 * @example
 * ```typescript
 * // Read the aircraft's altitude
 * const altitude = XPlane.dataref.getFloat("sim/flightmodel/position/elevation");
 * console.log(`Current altitude: ${altitude} meters`);
 * 
 * // Read the NAV1 radio frequency
 * const nav1Freq = XPlane.dataref.getInt("sim/cockpit/radios/nav1_freq_hz");
 * console.log(`NAV1 frequency: ${nav1Freq / 100} MHz`);
 * 
 * // Set the autopilot altitude
 * XPlane.dataref.setFloat("sim/cockpit/autopilot/altitude", 35000);
 * ```
 */
interface DataRefAPI {
    // =========================================================================
    // Lookup Functions
    // =========================================================================

    /**
     * Check if a dataref exists
     * 
     * @param name - The full path of the dataref (e.g., "sim/cockpit/radios/nav1_freq_hz")
     * @returns `true` if the dataref exists, `null` otherwise
     */
    find(name: string): boolean | null;

    /**
     * Check if a dataref is writable
     * 
     * @param name - The full path of the dataref
     * @returns `true` if writable, `false` if read-only or not found
     */
    canWrite(name: string): boolean;

    /**
     * Get the supported data types for a dataref
     * 
     * @param name - The full path of the dataref
     * @returns Object with boolean flags for each supported type, or `null` if not found
     */
    getTypes(name: string): DataRefTypes | null;

    // =========================================================================
    // Scalar Getters
    // =========================================================================

    /**
     * Read an integer value from a dataref
     * 
     * @param name - The full path of the dataref
     * @returns The integer value, or 0 if the dataref is not found
     */
    getInt(name: string): number;

    /**
     * Read a float value from a dataref
     * 
     * @param name - The full path of the dataref
     * @returns The float value, or 0.0 if the dataref is not found
     */
    getFloat(name: string): number;

    /**
     * Read a double-precision value from a dataref
     * 
     * @param name - The full path of the dataref
     * @returns The double value, or 0.0 if the dataref is not found
     */
    getDouble(name: string): number;

    // =========================================================================
    // Array Getters
    // =========================================================================

    /**
     * Read an integer array from a dataref
     * 
     * @param name - The full path of the dataref
     * @param offset - Start index in the array (default: 0)
     * @param count - Number of elements to read (default: all remaining)
     * @returns Array of integers, or `null` if the dataref is not found
     */
    getIntArray(name: string, offset?: number, count?: number): number[] | null;

    /**
     * Read a float array from a dataref
     * 
     * @param name - The full path of the dataref
     * @param offset - Start index in the array (default: 0)
     * @param count - Number of elements to read (default: all remaining)
     * @returns Array of floats, or `null` if the dataref is not found
     */
    getFloatArray(name: string, offset?: number, count?: number): number[] | null;

    /**
     * Read byte/string data from a dataref
     * 
     * @param name - The full path of the dataref
     * @param offset - Start byte offset (default: 0)
     * @param maxBytes - Maximum bytes to read (default: all remaining)
     * @returns String value, or empty string if the dataref is not found
     */
    getData(name: string, offset?: number, maxBytes?: number): string;

    // =========================================================================
    // Scalar Setters
    // =========================================================================

    /**
     * Write an integer value to a dataref
     * 
     * @param name - The full path of the dataref
     * @param value - The value to set
     * @returns `true` if successful, `false` if the dataref is not found or not writable
     */
    setInt(name: string, value: number): boolean;

    /**
     * Write a float value to a dataref
     * 
     * @param name - The full path of the dataref
     * @param value - The value to set
     * @returns `true` if successful, `false` if the dataref is not found or not writable
     */
    setFloat(name: string, value: number): boolean;

    /**
     * Write a double-precision value to a dataref
     * 
     * @param name - The full path of the dataref
     * @param value - The value to set
     * @returns `true` if successful, `false` if the dataref is not found or not writable
     */
    setDouble(name: string, value: number): boolean;

    // =========================================================================
    // Array Setters
    // =========================================================================

    /**
     * Write an integer array to a dataref
     * 
     * @param name - The full path of the dataref
     * @param values - Array of integers to write
     * @param offset - Start index in the dataref array (default: 0)
     * @returns `true` if successful, `false` if the dataref is not found or not writable
     */
    setIntArray(name: string, values: number[], offset?: number): boolean;

    /**
     * Write a float array to a dataref
     * 
     * @param name - The full path of the dataref
     * @param values - Array of floats to write
     * @param offset - Start index in the dataref array (default: 0)
     * @returns `true` if successful, `false` if the dataref is not found or not writable
     */
    setFloatArray(name: string, values: number[], offset?: number): boolean;

    /**
     * Write string/byte data to a dataref
     * 
     * @param name - The full path of the dataref
     * @param value - String value to write
     * @param offset - Start byte offset in the dataref (default: 0)
     * @returns `true` if successful, `false` if the dataref is not found or not writable
     */
    setData(name: string, value: string, offset?: number): boolean;
}

// =============================================================================
// Scenery API Types
// =============================================================================

/**
 * Result from terrain probing
 */
interface TerrainProbeResult {
    /** Whether the probe hit terrain */
    hit: boolean;
    /** Probe result code (only present if hit is false) */
    result?: number;
    /** X coordinate of terrain hit (local OpenGL) */
    x?: number;
    /** Y coordinate of terrain hit (local OpenGL) */
    y?: number;
    /** Z coordinate of terrain hit (local OpenGL) */
    z?: number;
    /** X component of terrain normal */
    normalX?: number;
    /** Y component of terrain normal */
    normalY?: number;
    /** Z component of terrain normal */
    normalZ?: number;
    /** X velocity of terrain (for moving platforms) */
    velocityX?: number;
    /** Y velocity of terrain */
    velocityY?: number;
    /** Z velocity of terrain */
    velocityZ?: number;
    /** Whether the terrain is water */
    isWet?: boolean;
}

/**
 * Scenery API for loading objects, terrain probing, and magnetic variation
 * 
 * @example
 * ```typescript
 * // Load an object
 * const objPath = XPlane.scenery.loadObject("Resources/default scenery/sim objects/apt_vehicles/pushback/Goldhofer_AST1_Tow.obj");
 * 
 * // Probe terrain at a location
 * const probeId = XPlane.scenery.createProbe();
 * const result = XPlane.scenery.probeTerrain(probeId, x, y, z);
 * if (result.hit) {
 *     console.log(`Terrain height: ${result.y}`);
 * }
 * 
 * // Get magnetic variation
 * const variation = XPlane.scenery.getMagneticVariation(47.4, -122.3);
 * ```
 */
interface SceneryAPI {
    // =========================================================================
    // Object Loading
    // =========================================================================

    /**
     * Load an OBJ file from the X-System folder
     * 
     * @param path - Path to the .obj file relative to X-System folder
     * @returns The object path as handle, or `null` if failed
     */
    loadObject(path: string): string | null;

    /**
     * Unload a previously loaded object
     * 
     * @param path - The object path/handle returned from loadObject
     * @returns `true` if successful
     */
    unloadObject(path: string): boolean;

    // =========================================================================
    // Terrain Probing
    // =========================================================================

    /**
     * Create a terrain probe
     * 
     * @param probeType - Type of probe (default: 0 = Y probe)
     * @returns Probe handle ID, or `null` if failed
     */
    createProbe(probeType?: number): number | null;

    /**
     * Destroy a terrain probe
     * 
     * @param probeId - The probe handle ID
     * @returns `true` if successful
     */
    destroyProbe(probeId: number): boolean;

    /**
     * Probe terrain at an XYZ location
     * 
     * @param probeId - The probe handle ID
     * @param x - X coordinate (local OpenGL)
     * @param y - Y coordinate (local OpenGL)
     * @param z - Z coordinate (local OpenGL)
     * @returns Terrain probe result with hit info and terrain properties
     */
    probeTerrain(probeId: number, x: number, y: number, z: number): TerrainProbeResult;

    // =========================================================================
    // Magnetic Variation
    // =========================================================================

    /**
     * Get magnetic variation at a geographic location
     * 
     * @param latitude - Latitude in degrees
     * @param longitude - Longitude in degrees
     * @returns Magnetic variation in degrees (positive = east)
     */
    getMagneticVariation(latitude: number, longitude: number): number;

    /**
     * Convert true heading to magnetic heading at current aircraft location
     * 
     * @param headingTrue - True heading in degrees
     * @returns Magnetic heading in degrees
     */
    degTrueToMagnetic(headingTrue: number): number;

    /**
     * Convert magnetic heading to true heading at current aircraft location
     * 
     * @param headingMagnetic - Magnetic heading in degrees
     * @returns True heading in degrees
     */
    degMagneticToTrue(headingMagnetic: number): number;
}

// =============================================================================
// Instance API Types
// =============================================================================

/**
 * Position and orientation for an instance
 */
interface InstancePosition {
    /** X coordinate (local OpenGL) */
    x: number;
    /** Y coordinate (local OpenGL) */
    y: number;
    /** Z coordinate (local OpenGL) */
    z: number;
    /** Pitch angle in degrees (optional, default: 0) */
    pitch?: number;
    /** Heading angle in degrees (optional, default: 0) */
    heading?: number;
    /** Roll angle in degrees (optional, default: 0) */
    roll?: number;
}

/**
 * Instance API for creating and managing object instances in the world
 * 
 * Instances are lightweight copies of loaded objects that can be placed
 * and animated efficiently. Use instances when you need multiple copies
 * of the same object.
 * 
 * @example
 * ```typescript
 * // Load the object first
 * const objPath = XPlane.scenery.loadObject("path/to/object.obj");
 * 
 * // Create an instance with animation datarefs
 * const instanceId = XPlane.instance.create(objPath, [
 *     "my_plugin/anim/rotation",
 *     "my_plugin/anim/brightness"
 * ]);
 * 
 * // Position the instance
 * XPlane.instance.setPosition(instanceId, {
 *     x: 100, y: 50, z: -200,
 *     heading: 90, pitch: 0, roll: 0
 * }, [45.0, 0.8]); // Animation dataref values
 * 
 * // Clean up when done
 * XPlane.instance.destroy(instanceId);
 * XPlane.scenery.unloadObject(objPath);
 * ```
 */
interface InstanceAPI {
    /**
     * Create an instance of a loaded object
     * 
     * @param objectPath - The object path/handle from loadObject
     * @param datarefs - Array of dataref names for animation (optional)
     * @returns Instance handle ID, or `null` if failed
     */
    create(objectPath: string, datarefs?: string[]): number | null;

    /**
     * Destroy an instance
     * 
     * @param instanceId - The instance handle ID
     * @returns `true` if successful
     */
    destroy(instanceId: number): boolean;

    /**
     * Set instance position and animation values
     * 
     * @param instanceId - The instance handle ID
     * @param position - Position and orientation
     * @param data - Array of float values for animation datarefs (optional)
     * @returns `true` if successful
     */
    setPosition(instanceId: number, position: InstancePosition, data?: number[]): boolean;
}

// =============================================================================
// Graphics API Types
// =============================================================================

/**
 * World coordinates (latitude/longitude/altitude)
 */
interface WorldCoordinates {
    /** Latitude in degrees */
    latitude: number;
    /** Longitude in degrees */
    longitude: number;
    /** Altitude in meters MSL */
    altitude: number;
}

/**
 * Local OpenGL coordinates
 */
interface LocalCoordinates {
    /** X coordinate (local OpenGL, meters) */
    x: number;
    /** Y coordinate (local OpenGL, meters - altitude) */
    y: number;
    /** Z coordinate (local OpenGL, meters) */
    z: number;
}

/**
 * Graphics API for coordinate conversions
 * 
 * X-Plane uses two coordinate systems:
 * - World: Latitude/Longitude/Altitude
 * - Local: OpenGL coordinates centered on the aircraft with Y up
 * 
 * @example
 * ```typescript
 * // Convert world to local coordinates
 * const local = XPlane.graphics.worldToLocal(47.4502, -122.3088, 100);
 * console.log(`Local coords: ${local.x}, ${local.y}, ${local.z}`);
 * 
 * // Convert local back to world
 * const world = XPlane.graphics.localToWorld(local.x, local.y, local.z);
 * console.log(`Lat: ${world.latitude}, Lon: ${world.longitude}`);
 * ```
 */
interface GraphicsAPI {
    /**
     * Convert local OpenGL coordinates to world coordinates
     * 
     * @param x - Local X coordinate
     * @param y - Local Y coordinate
     * @param z - Local Z coordinate
     * @returns World coordinates (lat/lon/alt)
     */
    localToWorld(x: number, y: number, z: number): WorldCoordinates;

    /**
     * Convert world coordinates to local OpenGL coordinates
     * 
     * @param latitude - Latitude in degrees
     * @param longitude - Longitude in degrees
     * @param altitude - Altitude in meters MSL
     * @returns Local OpenGL coordinates
     */
    worldToLocal(latitude: number, longitude: number, altitude: number): LocalCoordinates;
}

// =============================================================================
// HID API Types
// =============================================================================

/**
 * Information about a connected HID device
 */
interface HidDeviceInfo {
    /** Platform-specific device path */
    path: string;
    /** USB Vendor ID */
    vendorId: number;
    /** USB Product ID */
    productId: number;
    /** Serial number string */
    serialNumber: string;
    /** Device release number (BCD) */
    releaseNumber: number;
    /** Manufacturer name */
    manufacturer: string;
    /** Product name */
    product: string;
    /** HID Usage Page (Windows/Mac) */
    usagePage: number;
    /** HID Usage (Windows/Mac) */
    usage: number;
    /** USB interface number */
    interfaceNumber: number;
}

/**
 * Device info strings returned by getDeviceInfo()
 */
interface HidDeviceStrings {
    /** Manufacturer name */
    manufacturer: string;
    /** Product name */
    product: string;
    /** Serial number */
    serialNumber: string;
}

/**
 * HID API for communicating with USB Human Interface Devices
 *
 * Provides low-level access to HID devices such as joysticks, button boxes,
 * custom controllers, LED panels, and other USB peripherals. Built on the
 * cross-platform HIDAPI library.
 *
 * @example
 * ```typescript
 * // List all connected HID devices
 * const devices = XPlane.hid.enumerate();
 * devices.forEach(d => {
 *     console.log(`${d.manufacturer} ${d.product} (VID=0x${d.vendorId.toString(16)})`);
 * });
 *
 * // Open a device and read data
 * const dev = XPlane.hid.open(0x1234, 0x5678);
 * if (dev) {
 *     XPlane.hid.setNonBlocking(dev, true);
 *     const data = XPlane.hid.read(dev, 64, 100);
 *     if (data) {
 *         console.log('Received:', data);
 *     }
 *     XPlane.hid.close(dev);
 * }
 * ```
 */
interface HidAPI {
    /**
     * Enumerate connected HID devices
     *
     * @param vendorId - Filter by vendor ID (0 or omit for all devices)
     * @param productId - Filter by product ID (0 or omit for all devices)
     * @returns Array of device info objects
     */
    enumerate(vendorId?: number, productId?: number): HidDeviceInfo[];

    /**
     * Open a HID device by vendor and product ID
     *
     * @param vendorId - USB Vendor ID
     * @param productId - USB Product ID
     * @param serialNumber - Serial number string (optional, for selecting among multiple identical devices)
     * @returns Device handle ID, or `null` if the device could not be opened
     */
    open(vendorId: number, productId: number, serialNumber?: string): number | null;

    /**
     * Open a HID device by platform-specific path
     *
     * @param path - Device path from enumerate()
     * @returns Device handle ID, or `null` if the device could not be opened
     */
    openPath(path: string): number | null;

    /**
     * Close an open HID device
     *
     * @param deviceId - Device handle ID from open() or openPath()
     * @returns `true` if successful
     */
    close(deviceId: number): boolean;

    /**
     * Write an output report to a HID device
     *
     * The first byte must be the Report ID. For devices with a single report,
     * use 0x00 as the first byte.
     *
     * @param deviceId - Device handle ID
     * @param data - Array of bytes to write
     * @returns Number of bytes written, or -1 on error
     */
    write(deviceId: number, data: number[]): number;

    /**
     * Read an input report from a HID device
     *
     * @param deviceId - Device handle ID
     * @param length - Maximum number of bytes to read
     * @param timeoutMs - Timeout in milliseconds (optional; -1 = blocking, omit = use current blocking mode)
     * @returns Array of bytes read, empty array if no data (non-blocking), or `null` on error
     */
    read(deviceId: number, length: number, timeoutMs?: number): number[] | null;

    /**
     * Send a feature report to a HID device
     *
     * The first byte must be the Report ID.
     *
     * @param deviceId - Device handle ID
     * @param data - Array of bytes to send
     * @returns Number of bytes sent, or -1 on error
     */
    sendFeatureReport(deviceId: number, data: number[]): number;

    /**
     * Get a feature report from a HID device
     *
     * @param deviceId - Device handle ID
     * @param reportId - The Report ID to request
     * @param length - Maximum number of bytes to read
     * @returns Array of bytes read, or `null` on error
     */
    getFeatureReport(deviceId: number, reportId: number, length: number): number[] | null;

    /**
     * Get manufacturer, product, and serial number strings from an open device
     *
     * @param deviceId - Device handle ID
     * @returns Object with manufacturer, product, and serialNumber strings
     */
    getDeviceInfo(deviceId: number): HidDeviceStrings | null;

    /**
     * Set blocking or non-blocking mode for reads
     *
     * @param deviceId - Device handle ID
     * @param nonBlocking - `true` for non-blocking reads, `false` for blocking
     * @returns `true` if successful
     */
    setNonBlocking(deviceId: number, nonBlocking: boolean): boolean;
}

/**
 * Utilities API – command management and misc helpers
 */
interface UtilitiesAPI {
    /**
     * Find a command by persistent name. Returns an opaque numeric handle or `0`/`null` if not found.
     */
    findCommand(name: string): number | null;

    /**
     * Create a new command and return its handle.
     */
    createCommand(name: string, description: string): number;

    /**
     * Begin a command (must be balanced with `commandEnd`).
     */
    commandBegin(commandRef: number): void;

    /**
     * End a command previously begun.
     */
    commandEnd(commandRef: number): void;

    /**
     * Execute a command once (begin+end).
     */
    commandOnce(commandRef: number): void;

    /**
     * Register a JS handler for a command. The handler receives `(commandRef, phase, before)`
     * and should return `1` to allow further processing or `0` to suppress.
     * @param commandRef - Command handle returned by `findCommand`/`createCommand`
     * @param handler - JS function invoked on command phases
     * @param before - If true, handler runs before X-Plane and may suppress sim handling by returning 0
     * @returns true on success
     */
    registerCommandHandler(commandRef: number, handler: (commandRef: number, phase: number, before: boolean) => number, before: boolean): boolean;
}

// =============================================================================
// SkyScript API Types
// =============================================================================

/**
 * SkyScript API for app management, filesystem, path utilities, and app context.
 * Available through the global `SkyScript` object.
 */
interface SkyScriptAPI {
    /** List all installed SkyScript applications */
    listApps(): string[];

    /** Reload an app's view (refresh HTML/JS content) */
    reloadApp(name: string): boolean;

    /** Open/show an app's window */
    openAppWindow(name: string): boolean;

    /** Open the inspector/dev tools for an app */
    openAppInspector(name: string): boolean;

    /** Sandboxed filesystem access (paths relative to app directory) */
    fs: SkyScriptFsAPI;

    /** Cross-platform path utilities (pure string manipulation, no I/O) */
    path: SkyScriptPathAPI;

    /** Information about the current app */
    app: SkyScriptAppInfo;
}

/**
 * Filesystem API – sandboxed to the app directory.
 * All paths are resolved relative to the app root.
 * Attempts to escape via ".." are rejected.
 */
interface SkyScriptFsAPI {
    /**
     * Read a file as a UTF-8 string
     * @param path - Relative path within the app directory
     * @returns File contents, or `null` if not found / sandbox violation
     */
    readFile(path: string): string | null;

    /**
     * Write a string to a file (creates parent directories as needed)
     * @param path - Relative path within the app directory
     * @param content - String content to write
     * @returns `true` if successful
     */
    writeFile(path: string, content: string): boolean;

    /**
     * Check if a file or directory exists
     * @param path - Relative path within the app directory
     * @returns `true` if the path exists
     */
    exists(path: string): boolean;
}

/**
 * Cross-platform path utilities
 */
interface SkyScriptPathAPI {
    /**
     * Join path segments using the platform separator
     * @param parts - Path segments to join
     * @returns Normalised joined path
     */
    join(...parts: string[]): string;

    /**
     * Return the directory portion of a path
     * @param path - The path to extract from
     */
    dirname(path: string): string;

    /**
     * Return the last segment of a path
     * @param path - The path to extract from
     * @param ext - Optional extension to strip
     */
    basename(path: string, ext?: string): string;

    /**
     * Return the extension of a path (including the dot)
     * @param path - The path to extract from
     */
    extname(path: string): string;

    /**
     * Normalize a path, resolving '.' and '..' segments
     * @param path - The path to normalize
     */
    normalize(path: string): string;

    /** Platform-specific path separator ('/' on macOS/Linux, '\\' on Windows) */
    sep: string;
}

/**
 * Per-app context information, set automatically when the view is bound.
 */
interface SkyScriptAppInfo {
    /** Internal app name (directory name) */
    name: string;

    /** Human-readable display name from manifest.json */
    displayName: string;

    /** Absolute path to the app's root directory */
    dir: string;
}

export {};
