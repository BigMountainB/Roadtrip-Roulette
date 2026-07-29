"""
render_turntable.py — render a vehicle model to RTR yaw-billboard frames.

Reproduces EXACTLY the camera used by scripts/buildCarYawFrames.js, so the
output is a drop-in replacement for the placeholder frames.  The numbers below
are mirrored in public/assets/cars/spike/frames.json; if you change one, change
both or the car will sit wrong on the road.

    Camera:  90 mm lens, 36 mm sensor (horizontal fit), zero shift
             positioned 14 m behind the car at 1.35 m eye height,
             axis dead horizontal so the horizon lands at frame centre
    Output:  1024 x 700 RGBA PNG, transparent background, no baked shadow

USAGE
-----
    blender -b /path/to/car.blend -P scripts/render_turntable.py
    blender -b -P scripts/render_turntable.py -- --import /path/to/car.glb

Options after `--`:
    --import PATH   import .glb/.gltf/.obj/.fbx into an empty scene
    --name NAME     output prefix (default: spike_sedan)
    --out DIR       output directory (default: public/assets/cars/spike)
    --facing AXIS   which way the model's NOSE points: +Y -Y +X -X (default +Y)
    --length M      real length in metres to scale the model to (default 4.5)
    --samples N     Cycles samples (default 128)
    --engine E      CYCLES or BLENDER_EEVEE_NEXT (default CYCLES)

WHAT THIS SCRIPT NORMALISES FOR YOU
-----------------------------------
Downloaded models arrive at arbitrary scale, orientation and origin.  Rather
than making you fix that by hand, the script measures the world bounding box
and then scales to a known real length, rotates the nose to +Y, and drops the
footprint centre onto the origin.  That last part matters more than it sounds:
the whole framing convention is "car centred on its ground footprint", and if
the origin is at the model's centre of mass instead, every frame is subtly
mis-seated and the car will appear to bob as it rotates.
"""

import bpy
import sys
import json
import math
import os
from mathutils import Vector

# ── Framing constants — must match buildCarYawFrames.js ────────────────────
CANVAS_W       = 1024
CANVAS_H       = 700
CANVAS_WORLD_W = 5.6      # metres the frame spans at the car's depth
CAR_WORLD_W    = 1.8      # nominal car width, for the game's rescale
CAM_DIST       = 14.0     # metres behind the car
CAM_HEIGHT     = 1.35     # eye height
SENSOR_MM      = 36.0

YAW_ANGLES = [0, 8, 16, 24, 34, 45]

# Derived — identical arithmetic to the JS generator.
FOCAL_PX = (CANVAS_W / CANVAS_WORLD_W) * CAM_DIST
LENS_MM  = FOCAL_PX * SENSOR_MM / CANVAS_W          # == 90.0
HORIZON  = CANVAS_H / 2
GROUND_Y = HORIZON + (FOCAL_PX * CAM_HEIGHT) / CAM_DIST


# ── Arg parsing ────────────────────────────────────────────────────────────
def get_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {
        "import": None,
        "name": "spike_sedan",
        "out": None,
        "facing": "+Y",
        "length": 4.5,
        "samples": 128,
        "engine": "CYCLES",
    }
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            opts[key] = argv[i + 1]
            i += 2
        else:
            i += 1
    opts["length"] = float(opts["length"])
    opts["samples"] = int(opts["samples"])
    return opts


ARGS = get_args()

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = ARGS["out"] or os.path.join(HERE, "..", "public", "assets", "cars", "spike")
OUT_DIR = os.path.abspath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)


# ── Scene assembly ─────────────────────────────────────────────────────────
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        raise SystemExit(f"Unsupported model format: {ext}")


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def world_bbox(objs):
    """Axis-aligned bounds of everything, in world space."""
    lo = Vector((1e18, 1e18, 1e18))
    hi = Vector((-1e18, -1e18, -1e18))
    for o in objs:
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    return lo, hi


def normalise(objs, facing, target_length):
    """Scale to a real length, point the nose at +Y, seat the footprint at
    the origin.  Everything is parented to one empty so the yaw animation is
    a single rotation and multi-part models can't drift apart."""
    pivot = bpy.data.objects.new("CarPivot", None)
    bpy.context.scene.collection.objects.link(pivot)
    for o in objs:
        if o.parent is None:
            o.parent = pivot
            o.matrix_parent_inverse = pivot.matrix_world.inverted()

    # Rotate the nose to +Y first, so "length" is measured along Y.
    yaw_fix = {"+Y": 0.0, "-Y": math.pi, "+X": math.pi / 2, "-X": -math.pi / 2}
    if facing not in yaw_fix:
        raise SystemExit(f"--facing must be one of {list(yaw_fix)}")
    pivot.rotation_euler = (0.0, 0.0, yaw_fix[facing])
    bpy.context.view_layer.update()

    lo, hi = world_bbox(objs)
    length = hi.y - lo.y
    if length <= 0:
        raise SystemExit("Model has zero length — check the import.")
    s = target_length / length
    pivot.scale = (s, s, s)
    bpy.context.view_layer.update()

    # Re-measure after scaling, then seat: footprint centre to origin, and the
    # LOWEST point (tyre contact patch) to z = 0.
    lo, hi = world_bbox(objs)
    pivot.location = (
        pivot.location.x - (lo.x + hi.x) / 2,
        pivot.location.y - (lo.y + hi.y) / 2,
        pivot.location.z - lo.z,
    )
    bpy.context.view_layer.update()

    lo, hi = world_bbox(objs)
    print(f"  normalised: {hi.x-lo.x:.2f} W x {hi.y-lo.y:.2f} L x {hi.z-lo.z:.2f} H (m)")
    if abs((hi.x - lo.x) - CAR_WORLD_W) > 0.45:
        print(f"  ! width {hi.x-lo.x:.2f} m is far from the assumed {CAR_WORLD_W} m.")
        print(f"  ! set carWorldW in frames.json to match, or the game will mis-size it.")
    if (hi.x - lo.x) > CANVAS_WORLD_W * 0.55:
        print(f"  ! car may clip the frame at 45deg — raise CANVAS_WORLD_W.")
    return pivot


def setup_camera():
    cam_data = bpy.data.cameras.new("SpikeCam")
    cam_data.type = "PERSP"
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = SENSOR_MM
    cam_data.lens = LENS_MM
    # Zero shift is the whole reason the horizon is pinned to frame centre.
    cam_data.shift_x = 0.0
    cam_data.shift_y = 0.0
    cam = bpy.data.objects.new("SpikeCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    # Behind the car on -Y, looking along +Y, axis dead level (no pitch).
    cam.location = (0.0, -CAM_DIST, CAM_HEIGHT)
    cam.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    bpy.context.scene.camera = cam
    return cam


def setup_lighting():
    """Key from upper-left, angled slightly toward camera — matches the
    placeholder generator's light vector so placeholder and real frames
    read the same way.  Inconsistent lighting BETWEEN frames is what makes
    a turntable strobe, so the rig is fixed in world space and only the car
    rotates beneath it."""
    sun_data = bpy.data.lights.new("Key", type="SUN")
    sun_data.energy = 3.2
    sun_data.angle = math.radians(2.5)      # slightly soft terminator
    sun = bpy.data.objects.new("Key", sun_data)
    bpy.context.scene.collection.objects.link(sun)
    # Light travels from (-0.45, -0.35, +0.82) toward the origin.
    sun.rotation_euler = (math.radians(35.0), 0.0, math.radians(-28.0))

    fill_data = bpy.data.lights.new("Fill", type="AREA")
    fill_data.energy = 220.0
    fill_data.size = 9.0
    fill = bpy.data.objects.new("Fill", fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = (5.5, -8.0, 4.0)
    fill.rotation_euler = (math.radians(58.0), 0.0, math.radians(38.0))

    # Flat sky ambient. Deliberately neutral: the game tints and fogs these
    # sprites itself, so a colour cast baked in here fights the road palette.
    world = bpy.data.worlds.new("SpikeWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.52, 0.58, 0.66, 1.0)
    bg.inputs[1].default_value = 0.55
    bpy.context.scene.world = world


def setup_render(engine, samples):
    scene = bpy.context.scene
    scene.render.resolution_x = CANVAS_W
    scene.render.resolution_y = CANVAS_H
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True     # no baked ground shadow
    try:
        scene.render.engine = engine
    except TypeError:
        print(f"  ! engine {engine} unavailable, falling back to CYCLES")
        scene.render.engine = "CYCLES"
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    if ARGS["import"]:
        clear_scene()
        import_model(os.path.abspath(ARGS["import"]))
    else:
        # Using the already-open .blend: strip any camera/light it shipped
        # with, so its rig can't override ours.
        for o in list(bpy.context.scene.objects):
            if o.type in ("CAMERA", "LIGHT"):
                bpy.data.objects.remove(o, do_unlink=True)

    objs = mesh_objects()
    if not objs:
        raise SystemExit("No mesh objects found — pass --import, or open a .blend with a model.")

    print(f"\nrender_turntable: {len(objs)} mesh object(s)")
    pivot = normalise(objs, ARGS["facing"], ARGS["length"])
    setup_camera()
    setup_lighting()
    setup_render(ARGS["engine"], ARGS["samples"])

    base_z = pivot.rotation_euler.z
    for yaw in YAW_ANGLES:
        # +yaw swings the car's LEFT flank toward the camera, matching the
        # game's sign convention (positive yaw = car is to our right).
        pivot.rotation_euler.z = base_z + math.radians(yaw)
        tag = str(yaw).zfill(2)
        path = os.path.join(OUT_DIR, f"{ARGS['name']}_back_y{tag}.png")
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f"  {os.path.basename(path)}  yaw {yaw}deg")

    meta = {
        "_comment": "Generated by scripts/render_turntable.py (Blender).",
        "canvasW": CANVAS_W,
        "canvasH": CANVAS_H,
        "canvasWorldW": CANVAS_WORLD_W,
        "carWorldW": CAR_WORLD_W,
        "camDist": CAM_DIST,
        "camHeight": CAM_HEIGHT,
        "focalPx": FOCAL_PX,
        "lensMm": LENS_MM,
        "groundY": GROUND_Y,
        "groundFrac": GROUND_Y / CANVAS_H,
        "angles": YAW_ANGLES,
        "keyPrefix": f"{ARGS['name']}_back_y",
    }
    with open(os.path.join(OUT_DIR, "frames.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n{len(YAW_ANGLES)} frames + frames.json -> {OUT_DIR}")
    print("Update GameScene.SPIKE_YAW.keyPrefix + AssetManifest if --name changed.")


main()
