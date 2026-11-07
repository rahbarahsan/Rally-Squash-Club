"""Original stylized rig with runtime IK attachment bones; Blender 5.2, metres."""
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
ROOT = Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
materials = {}
for name, color in [('Kit', (0.65, 0.85, 0.3, 1)), ('Skin', (0.53, 0.29, 0.17, 1)), ('Dark', (0.018, 0.045, 0.032, 1)), ('White', (0.9, 0.91, 0.84, 1)), ('Carbon', (0.025, 0.07, 0.055, 1)), ('Strings', (0.72, 0.8, 0.7, 1)), ('Hair', (0.035, 0.022, 0.015, 1)), ('Hair highlight', (0.05, 0.032, 0.022, 1)), ('Lip', (0.31, 0.12, 0.085, 1))]:
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = color
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.48 if name.startswith('Hair') else 0.7
    materials[name] = m

for name, color in [('ShortsFabric', (0.022, 0.04, 0.065, 1)), ('ShortsTrim', (0.12, 0.24, 0.29, 1))]:
    m = bpy.data.materials.new(name)
    m.diffuse_color = color
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = color
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.92
    materials[name] = m

def vec(p):
    return Vector((p[0], -p[2], p[1]))
centers = {'Torso': (0, 1.24, 0), 'Shorts': (0, 0.85, 0), 'Head': (0, 1.79, -0.025), 'Neck': (0, 1.61, 0), 'Racket': (0.43, 1.12, -0.38)}
for label, sign in [('L', -1), ('R', 1)]:
    centers.update({f'UpperArm{label}': (sign * 0.27, 1.28, 0), f'LowerArm{label}': (sign * 0.27, .92, 0), f'Hand{label}': (sign * 0.27, .74, 0), f'Thigh{label}': (sign * 0.135, 0.65, 0), f'Shin{label}': (sign * 0.17, 0.23, 0), f'Shoe{label}': (sign * 0.17, 0.065, -0.05)})
segment_bones = {name for name in centers if name.startswith(('UpperArm', 'LowerArm', 'Thigh', 'Shin'))}
bpy.ops.object.armature_add()
rig = bpy.context.object
rig.name = 'AthleteRig'
bpy.ops.object.mode_set(mode='EDIT')
root = rig.data.edit_bones[0]
root.name = 'Root'
root.head = (0, 0, 0)
root.tail = (0, 0, 0.1)
for name, center in centers.items():
    bone = rig.data.edit_bones.new(name)
    bone.head = vec(center)
    bone.tail = bone.head + Vector((0, 0, -0.1 if name in segment_bones else 0.1))
    bone.parent = root
bpy.ops.object.mode_set(mode='OBJECT')
parts = []

def skin(obj, material, bone):
    obj.data.materials.append(materials[material])
    for face in obj.data.polygons:
        face.use_smooth = True
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
    if bone in segment_bones:
        # Author attachment geometry in its segment coordinates, then place it
        # into a natural downward bind pose. This also permits blended clothing.
        pivot = vec(centers[bone])
        obj.matrix_world = Matrix.Translation(pivot) @ Matrix.Rotation(math.pi, 4, 'X') @ Matrix.Translation(-pivot) @ obj.matrix_world
    parts.append(obj)
    return obj

def ellipsoid(name, center, scale, material, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=vec(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return skin(obj, material, bone)

def profile(name, center, rings, material, bone):
    verts, faces, count = ([], [], 32)
    for y, rx, rz in rings:
        for i in range(count):
            a = i * math.tau / count
            verts.append(vec((center[0] + rx * math.cos(a), center[1] + y, center[2] + rz * math.sin(a))))
    for r in range(len(rings) - 1):
        for i in range(count):
            a = r * count + i
            b = r * count + (i + 1) % count
            faces.append((a, a + count, b + count, b))
    # Rings wind clockwise when viewed from above in game Y-up space.
    faces.extend([tuple(range(count)), tuple(reversed(range((len(rings) - 1) * count, len(rings) * count)))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return skin(obj, material, bone)
profile('Training jersey', centers['Torso'], [(-0.35, 0.20, 0.135), (-0.27, 0.205, 0.14), (-0.08, 0.21, 0.14), (0.12, 0.245, 0.145), (0.24, 0.235, 0.12), (0.3, 0.09, 0.075)], 'Kit', 'Torso')
profile('Jersey hem', centers['Torso'], [(-0.35, 0.202, 0.138), (-0.33, 0.204, 0.14)], 'Kit', 'Torso')
profile('Collar', centers['Torso'], [(0.275, 0.10, 0.082), (0.305, 0.083, 0.074)], 'Dark', 'Torso')
for sign in [-1, 1]:
    ellipsoid('Shoulder seam', (sign * 0.235, 1.435, 0), (0.075, 0.065, 0.10), 'Kit', 'Torso')

def sports_shorts():
    """One connected garment: shared waistband/seat, two open, leg-following cuffs."""
    count = 32
    vertices, weights, faces, face_materials = [], [], [], []

    def vertex(x, y, z, weight):
        vertices.append(vec((x, y, z)))
        weights.append(weight)
        return len(vertices) - 1

    def face(indices, material=0):
        faces.append(tuple(indices))
        face_materials.append(material)

    def connect(upper, lower, trim=False):
        for i in range(count):
            j = (i + 1) % count
            face((upper[i], upper[j], lower[j], lower[i]), 1 if trim else 0)

    rings = []
    for y, rx, rz in [(0.98, 0.208, 0.144), (0.925, 0.222, 0.15), (0.83, 0.245, 0.167), (0.74, 0.255, 0.17)]:
        ring = []
        for i in range(count):
            a = math.tau * i / count
            x, z = rx * math.cos(a), rz * math.sin(a)
            leg_weight = 0.18 if y == 0.74 else 0
            right = max(0, min(1, (x + 0.04) / 0.08))
            ring.append(vertex(x, y, z, {'Shorts': 1 - leg_weight, 'ThighR': leg_weight * right, 'ThighL': leg_weight * (1 - right)}))
        if rings:
            connect(rings[-1], ring)
        rings.append(ring)
    face(reversed(rings[0]))
    # The shared bridge makes a closed crotch seam instead of overlapping tubes.
    bridge = []
    for j in range(1, 16):
        t = j / 16
        bridge.append(vertex(0, 0.74 - 0.025 * math.sin(t * math.pi), 0.17 * math.cos(t * math.pi), {'Shorts': 0.82, 'ThighL': 0.09, 'ThighR': 0.09}))
    for sign, label in [(1, 'R'), (-1, 'L')]:
        indices = range(-8, 9) if sign == 1 else range(8, 25)
        upper = [rings[-1][i % count] for i in indices] + (bridge if sign == 1 else list(reversed(bridge)))
        for y, rx, rz, influence, trim in [(0.66, 0.137, 0.157, 0.75, False), (0.555, 0.141, 0.155, 1, False), (0.535, 0.141, 0.155, 1, True)]:
            lower = []
            for i in range(count):
                a = (-math.pi / 2 if sign == 1 else math.pi / 2) + math.tau * i / count
                fold = 1 + 0.018 * math.cos(5 * a + 0.4)
                lower.append(vertex(sign * 0.135 + rx * math.cos(a) * fold, y, rz * math.sin(a) * fold, {'Shorts': 1 - influence, 'Thigh' + label: influence}))
            connect(upper, lower, trim)
            upper = lower
    mesh = bpy.data.meshes.new('Loose sports shorts')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Loose sports shorts', mesh)
    bpy.context.collection.objects.link(obj)
    for material in ['ShortsFabric', 'ShortsTrim']:
        obj.data.materials.append(materials[material])
    for polygon, material_index in zip(mesh.polygons, face_materials):
        polygon.material_index = material_index
        polygon.use_smooth = True
    for name in ['Shorts', 'ThighL', 'ThighR']:
        group = obj.vertex_groups.new(name=name)
        for index, weight in enumerate(weights):
            if weight.get(name, 0) > 0:
                group.add([index], weight[name], 'REPLACE')
    parts.append(obj)

sports_shorts()
ellipsoid('Neck', centers['Neck'], (0.057, 0.065, 0.058), 'Skin', 'Neck')
profile('Sculpted jaw and face', centers['Head'], [(-0.145, 0.055, 0.065), (-0.11, 0.085, 0.085), (-0.035, 0.115, 0.11), (0.04, 0.12, 0.12), (0.11, 0.10, 0.10), (0.15, 0.035, 0.04)], 'Skin', 'Head')
ellipsoid('Nose bridge', (0, 1.795, -0.144), (0.015, 0.038, 0.021), 'Skin', 'Head')
ellipsoid('Nose tip', (0, 1.768, -0.158), (0.021, 0.014, 0.021), 'Skin', 'Head')
ellipsoid('Lower lip', (0, 1.728, -0.127), (0.031, 0.005, 0.007), 'Lip', 'Head')
for sign in [-1, 1]:
    ellipsoid('Eye socket', (sign * 0.047, 1.818, -0.134), (0.019, 0.010, 0.007), 'Skin', 'Head')
    ellipsoid('Eye white', (sign * 0.047, 1.819, -0.139), (0.013, 0.0055, 0.004), 'White', 'Head')
    ellipsoid('Iris', (sign * 0.047, 1.819, -0.143), (0.005, 0.005, 0.002), 'Hair', 'Head')
    ellipsoid('Brow', (sign * 0.049, 1.841, -0.13), (0.023, 0.005, 0.006), 'Hair', 'Head')
    ellipsoid('Ear', (sign * 0.119, 1.785, -0.012), (0.018, 0.035, 0.022), 'Skin', 'Head')

# A shaped scalp and swept locks replace the smooth helmet/headband silhouette.
ellipsoid('Hair crown', (0, 1.904, -0.008), (0.12, 0.049, 0.115), 'Hair', 'Head')
for sign in [-1, 1]:
    ellipsoid('Hair fade', (sign * 0.107, 1.858, 0.004), (0.019, 0.059, 0.082), 'Hair', 'Head')
    ellipsoid('Sideburn', (sign * 0.112, 1.824, -0.058), (0.009, 0.027, 0.016), 'Hair', 'Head')

def hair_lock(index, x):
    verts, faces = [], []
    count, steps = 8, 9
    for j in range(steps):
        t = j / (steps - 1)
        px = x + 0.015 * math.sin(t * math.pi)
        py = 1.906 + 0.045 * math.sin(t * math.pi) - abs(x) * 0.16
        pz = -0.112 + 0.22 * t
        radius = (0.011 + 0.003 * math.sin(t * math.pi)) * (1 - 0.75 * t)
        for i in range(count):
            a = math.tau * i / count
            verts.append(vec((px + radius * math.cos(a), py + radius * 0.35 * math.sin(a), pz)))
    for j in range(steps - 1):
        for i in range(count):
            a = j * count + i
            b = j * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.extend([tuple(reversed(range(count))), tuple(range((steps - 1) * count, steps * count))])
    mesh = bpy.data.meshes.new('Swept lock')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Swept lock', mesh)
    bpy.context.collection.objects.link(obj)
    skin(obj, 'Hair highlight' if index % 3 == 0 else 'Hair', 'Head')

for i in range(11):
    hair_lock(i, (i - 5) * 0.019)
def deforming_limb(name, rings, upper, lower, transition):
    """A connected surface with a smooth weight blend across the bend."""
    verts, faces, count, groups = [], [], 32, []
    high, low = transition
    for x, y, z, rx, rz in rings:
        blend = max(0, min(1, (high - y) / (high - low)))
        blend = blend * blend * (3 - 2 * blend)
        for i in range(count):
            a = i * math.tau / count
            verts.append(vec((x + rx * math.cos(a), y, z + rz * math.sin(a))))
            groups.append(blend)
    for row in range(len(rings) - 1):
        for i in range(count):
            a = row * count + i
            b = row * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.extend([tuple(reversed(range(count))), tuple(range((len(rings)-1)*count, len(rings)*count))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(materials['Skin'])
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    for bone, reverse in [(upper, True), (lower, False)]:
        group = obj.vertex_groups.new(name=bone)
        for i, blend in enumerate(groups):
            weight = 1 - blend if reverse else blend
            if weight > 0:
                group.add([i], weight, 'REPLACE')
    parts.append(obj)

for label, sign in [('L', -1), ('R', 1)]:
    deforming_limb('Continuous arm ' + label, [
        (sign*.27, 1.39, 0, .07, .073),
        (sign*.27, 1.23, 0, .063, .066),
        (sign*.27, 1.15, 0, .052, .057),
        (sign*.27, 1.10, 0, .047, .052),
        (sign*.27, 1.055, 0, .05, .054),
        (sign*.27, .99, 0, .055, .059),
        (sign*.27, .88, 0, .045, .049),
        (sign*.27, .77, 0, .032, .035),
        (sign*.27, .735, 0, .031, .033),
    ], 'UpperArm'+label, 'LowerArm'+label, (1.18, 1.02))
    profile('Sleeve'+label, centers['UpperArm'+label], [(-.195,.088,.085),(-.10,.08,.08),(-.035,.076,.077)], 'Kit', 'UpperArm'+label)
    ellipsoid('Hand'+label, centers['Hand'+label], (.038,.059,.03), 'Skin', 'Hand'+label)
    hand = centers['Hand'+label]
    ellipsoid('Thumb'+label, (hand[0]-sign*.03,hand[1]+.006,hand[2]-.02), (.016,.033,.016), 'Skin', 'Hand'+label)
    deforming_limb('Continuous leg '+label, [
        (sign*.14,.61,0,.078,.083),
        (sign*.145,.54,0,.073,.078),
        (sign*.15,.48,0,.065,.069),
        (sign*.152,.44,-.004,.059,.064),
        (sign*.155,.41,0,.056,.059),
        (sign*.16,.37,.006,.059,.063),
        (sign*.17,.31,.009,.069,.073),
        (sign*.17,.23,.005,.06,.064),
        (sign*.17,.15,0,.045,.05),
        (sign*.17,.065,0,.039,.044),
    ], 'Thigh'+label, 'Shin'+label, (.49,.37))
    profile('Sock'+label, centers['Shin'+label], [(.09,.049,.054),(.215,.044,.049)], 'White', 'Shin'+label)
    shoe=centers['Shoe'+label]
    ellipsoid('Trainer'+label, shoe, (.078,.052,.145), 'White', 'Shoe'+label)
    ellipsoid('Sole'+label, (shoe[0],.025,shoe[2]), (.08,.018,.147), 'Dark', 'Shoe'+label)

# Merge overlapping jersey panels into one smooth surface, then bind the
# shoulders gradually to the arms. Separate ball-shaped joints are unnecessary.
jersey = [obj for obj in parts if obj.data.materials[0].name == 'Kit']
bpy.ops.object.select_all(action='DESELECT')
for obj in jersey:
    obj.select_set(True)
bpy.context.view_layer.objects.active = jersey[0]
bpy.ops.object.join()
shirt = bpy.context.object
shirt.name = 'Continuous jersey'
for obj in jersey:
    parts.remove(obj)
remesh=shirt.modifiers.new('Joined cloth surface','REMESH')
remesh.mode='VOXEL'
remesh.voxel_size=.012
remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=shirt.modifiers.new('Cloth smoothing','SMOOTH')
smooth.factor=.7
smooth.iterations=5
bpy.ops.object.modifier_apply(modifier=smooth.name)
shirt.vertex_groups.clear()
shirt.data.materials.clear()
shirt.data.materials.append(materials['Kit'])
shirt_groups={name:shirt.vertex_groups.new(name=name) for name in ['Torso','UpperArmL','UpperArmR']}
for vertex in shirt.data.vertices:
    point=shirt.matrix_world @ vertex.co
    x,y,z=point.x,point.z,-point.y
    arm=max(0,min(1,(abs(x)-.18)/.15))
    arm=arm*arm*(3-2*arm)
    arm*=max(0,min(1,(1.58-y)/.08))
    shirt_groups['Torso'].add([vertex.index],1-arm,'REPLACE')
    if arm>0:
        shirt_groups['UpperArmR' if x>0 else 'UpperArmL'].add([vertex.index],arm,'REPLACE')
for polygon in shirt.data.polygons:
    polygon.use_smooth=True
parts.append(shirt)
racket = centers['Racket']
profile('Grip', racket, [(0, 0.023, 0.023), (0.16, 0.023, 0.023)], 'Dark', 'Racket')
profile('Shaft', racket, [(0.16, 0.014, 0.014), (0.34, 0.01, 0.01)], 'Carbon', 'Racket')
bpy.ops.mesh.primitive_torus_add(major_radius=0.165, minor_radius=0.012, major_segments=40, minor_segments=8, location=vec((racket[0], racket[1] + 0.5, racket[2])), rotation=(math.pi / 2, 0, 0))
rim = bpy.context.object
rim.scale = (0.8, 1.3, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
skin(rim, 'White', 'Racket')

def string(a, b):
    delta = vec(b) - vec(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.0015, depth=delta.length, location=(vec(a) + vec(b)) * 0.5)
    obj = bpy.context.object
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    skin(obj, 'Strings', 'Racket')
for i in range(-4, 5):
    x = i * 0.025
    extent = 0.21 * math.sqrt(max(0, 1 - (x / 0.132) ** 2))
    string((racket[0] + x, racket[1] + 0.5 - extent, racket[2]), (racket[0] + x, racket[1] + 0.5 + extent, racket[2]))
    y = i * 0.04
    extent = 0.13 * math.sqrt(max(0, 1 - (y / 0.215) ** 2))
    string((racket[0] - extent, racket[1] + 0.5 + y, racket[2]), (racket[0] + extent, racket[1] + 0.5 + y, racket[2]))
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
mesh = bpy.context.object
mesh.name = 'Athlete'
mesh.parent = rig
mod = mesh.modifiers.new('Skin', 'ARMATURE')
mod.object = rig
rig.animation_data_create()
clips = ['Ready', 'Split', 'Move', 'Recover', 'Forehand', 'Backhand', 'Lunge', 'Volley', 'Serve', 'Win', 'Lose']
for name in clips:
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in [1, 8, 16, 24, 32]:
        t = (frame - 1) / 31
        for bone in rig.pose.bones:
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = (0, 0, 0)
            wave = math.sin(t * math.pi)
            if bone.name == 'Torso':
                bone.rotation_euler.x = wave * {'Lunge': 0.12, 'Serve': -0.08, 'Lose': 0.1}.get(name, 0.025)
                bone.rotation_euler.y = wave * {'Forehand': 0.1, 'Backhand': -0.1, 'Volley': 0.06, 'Win': 0.04}.get(name, 0)
            if bone.name == 'Head':
                bone.rotation_euler.x = wave * {'Win': -0.1, 'Lose': 0.15}.get(name, 0.015)
            bone.keyframe_insert('rotation_euler', frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = True
for bone in rig.pose.bones:
    bone.rotation_euler = (0, 0, 0)
(ROOT / 'assets/blender').mkdir(parents=True, exist_ok=True)
(ROOT / 'public/models').mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/athlete.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/models/athlete.glb'), export_format='GLB', export_animations=True, export_animation_mode='ACTIONS')
