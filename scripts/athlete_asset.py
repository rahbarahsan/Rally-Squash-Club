"""Original stylized rig with runtime IK attachment bones; Blender 5.2, metres."""
import math
from pathlib import Path
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
for name,color in [('Kit',(.65,.85,.3,1)),('Skin',(.53,.29,.17,1)),('Dark',(.018,.045,.032,1)),('White',(.9,.91,.84,1)),('Carbon',(.025,.07,.055,1)),('Strings',(.72,.8,.7,1))]:
    m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.7
    materials[name]=m
def vec(p):return Vector((p[0],-p[2],p[1]))
centers={'Torso':(0,1.24,0),'Shorts':(0,.85,0),'Head':(0,1.79,-.025),'Neck':(0,1.61,0),'Racket':(.43,1.12,-.38)}
for label,sign in [('L',-1),('R',1)]:
    centers.update({f'UpperArm{label}':(sign*.3,1.3,0),f'LowerArm{label}':(sign*.35,1,0),f'Hand{label}':(sign*.35,.83,0),f'Thigh{label}':(sign*.135,.65,0),f'Shin{label}':(sign*.17,.23,0),f'Shoe{label}':(sign*.17,.065,-.05)})
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='AthleteRig'
bpy.ops.object.mode_set(mode='EDIT');root=rig.data.edit_bones[0];root.name='Root';root.head=(0,0,0);root.tail=(0,0,.1)
for name,center in centers.items():
    bone=rig.data.edit_bones.new(name);bone.head=vec(center);bone.tail=bone.head+Vector((0,0,.1));bone.parent=root
bpy.ops.object.mode_set(mode='OBJECT');parts=[]
def skin(obj,material,bone):
    obj.data.materials.append(materials[material])
    for face in obj.data.polygons:face.use_smooth=True
    group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE');parts.append(obj);return obj
def ellipsoid(name,center,scale,material,bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=vec(center));obj=bpy.context.object;obj.name=name;obj.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return skin(obj,material,bone)
def profile(name,center,rings,material,bone):
    verts,faces,count=[],[],20
    for y,rx,rz in rings:
        for i in range(count):
            a=i*math.tau/count;verts.append(vec((center[0]+rx*math.cos(a),center[1]+y,center[2]+rz*math.sin(a))))
    for r in range(len(rings)-1):
        for i in range(count):
            a=r*count+i;b=r*count+(i+1)%count;faces.append((a,b,b+count,a+count))
    faces.extend([tuple(reversed(range(count))),tuple(range((len(rings)-1)*count,len(rings)*count))]);mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);return skin(obj,material,bone)
profile('Tailored jersey',centers['Torso'],[(-.34,.17,.12),(-.29,.2,.135),(-.05,.225,.145),(.16,.26,.15),(.27,.21,.12),(.32,.095,.08)],'Kit','Torso')
profile('Jersey hem',centers['Torso'],[(-.34,.174,.123),(-.31,.202,.138)],'White','Torso')
profile('Shorts',centers['Shorts'],[(-.12,.22,.15),(.08,.21,.145),(.12,.18,.13)],'Dark','Shorts')
ellipsoid('Neck',centers['Neck'],(.075,.09,.075),'Skin','Neck');ellipsoid('Face',centers['Head'],(.145,.185,.14),'Skin','Head');ellipsoid('Hair',(0,1.9,-.015),(.148,.09,.14),'Dark','Head');ellipsoid('Nose',(0,1.78,-.16),(.032,.045,.038),'Skin','Head')
for sign in [-1,1]:
    ellipsoid('Eye',(sign*.052,1.82,-.152),(.017,.016,.012),'Dark','Head');ellipsoid('Ear',(sign*.145,1.79,-.025),(.026,.048,.027),'Skin','Head')
profile('Headband',centers['Head'],[(.065,.149,.144),(.095,.148,.141)],'White','Head')
for label,sign in [('L',-1),('R',1)]:
    profile('Sleeve'+label,centers['UpperArm'+label],[(-.18,.105,.095),(-.03,.09,.085),(.18,.07,.07)],'Kit','UpperArm'+label)
    upper=centers['UpperArm'+label];ellipsoid('Elbow'+label,(upper[0],upper[1]+.18,upper[2]),(.065,.065,.065),'Skin','UpperArm'+label)
    profile('Forearm'+label,centers['LowerArm'+label],[(-.18,.065,.065),(-.08,.06,.065),(.15,.05,.05),(.18,.045,.05)],'Skin','LowerArm'+label)
    ellipsoid('Hand'+label,centers['Hand'+label],(.055,.073,.045),'Skin','Hand'+label)
    profile('Thigh'+label,centers['Thigh'+label],[(-.215,.105,.105),(-.06,.087,.095),(.215,.068,.07)],'Skin','Thigh'+label)
    thigh=centers['Thigh'+label];ellipsoid('Knee'+label,(thigh[0],thigh[1]+.215,thigh[2]),(.074,.074,.074),'Skin','Thigh'+label)
    profile('Calf'+label,centers['Shin'+label],[(-.215,.065,.065),(-.08,.075,.078),(.11,.052,.058),(.215,.047,.05)],'Skin','Shin'+label)
    profile('Sock'+label,centers['Shin'+label],[(.09,.058,.064),(.215,.051,.054)],'White','Shin'+label)
    shoe=centers['Shoe'+label];ellipsoid('Trainer'+label,shoe,(.09,.066,.16),'White','Shoe'+label);ellipsoid('Sole'+label,(shoe[0],.025,shoe[2]),(.092,.025,.162),'Dark','Shoe'+label)
racket=centers['Racket'];profile('Grip',racket,[(0,.023,.023),(.16,.023,.023)],'Dark','Racket');profile('Shaft',racket,[(.16,.014,.014),(.34,.01,.01)],'Carbon','Racket')
bpy.ops.mesh.primitive_torus_add(major_radius=.165,minor_radius=.012,major_segments=40,minor_segments=8,location=vec((racket[0],racket[1]+.5,racket[2])),rotation=(math.pi/2,0,0));rim=bpy.context.object;rim.scale=(.8,1.3,1);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);skin(rim,'White','Racket')
def string(a,b):
    delta=vec(b)-vec(a);bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.0015,depth=delta.length,location=(vec(a)+vec(b))*.5);obj=bpy.context.object;obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);skin(obj,'Strings','Racket')
for i in range(-4,5):
    x=i*.025;extent=.21*math.sqrt(max(0,1-(x/.132)**2));string((racket[0]+x,racket[1]+.5-extent,racket[2]),(racket[0]+x,racket[1]+.5+extent,racket[2]));y=i*.04;extent=.13*math.sqrt(max(0,1-(y/.215)**2));string((racket[0]-extent,racket[1]+.5+y,racket[2]),(racket[0]+extent,racket[1]+.5+y,racket[2]))
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='Athlete';mesh.parent=rig;mod=mesh.modifiers.new('Skin','ARMATURE');mod.object=rig
rig.animation_data_create();clips=['Ready','Split','Move','Recover','Forehand','Backhand','Lunge','Volley','Serve','Win','Lose']
for name in clips:
    action=bpy.data.actions.new(name);rig.animation_data.action=action
    for frame in [1,8,16,24,32]:
        t=(frame-1)/31
        for bone in rig.pose.bones:
            bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0);wave=math.sin(t*math.pi)
            if bone.name=='Torso':bone.rotation_euler.x=wave*({'Lunge':.12,'Serve':-.08,'Lose':.1}.get(name,.025));bone.rotation_euler.y=wave*({'Forehand':.1,'Backhand':-.1,'Volley':.06,'Win':.04}.get(name,0))
            if bone.name=='Head':bone.rotation_euler.x=wave*({'Win':-.1,'Lose':.15}.get(name,.015))
            bone.keyframe_insert('rotation_euler',frame=frame)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action)
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for bone in rig.pose.bones:bone.rotation_euler=(0,0,0)
(ROOT/'assets/blender').mkdir(parents=True,exist_ok=True);(ROOT/'public/models').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/athlete.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/athlete.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS')
