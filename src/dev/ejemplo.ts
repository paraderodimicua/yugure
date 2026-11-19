// Visor de desarrollo de ejemplo: copia este patrón para probar un módulo aislado.
// Abrir en http://localhost:5183/dev/ejemplo.html
// En consola: __y.view.pos.set(x,y,z); __y.view.look.set(x,y,z); await __y.shot('nombre.jpg')  -> guarda en shots/
import * as THREE from 'three';
import { createStage } from '../stage';
import { createMaterials } from '../render/materials';

const st = createStage({ cam: [6, 3, 9], look: [0, 1.2, 0], focus: [0, 0, 0], shadowHalf: 14, dynamicShadows: true });
st.view.sway = false;
const mats = createMaterials(st.U);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.cobble);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
st.scene.add(ground);

const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.woodWarm);
box.position.y = 0.5; box.castShadow = box.receiveShadow = true;
st.scene.add(box);

st.onTick((t) => { box.rotation.y = t * 0.3; });
st.start();
