import { createStage } from './stage';
import { createMaterials } from './render/materials';
import { createArchKit } from './world/arch';
import { createStreet, BACK_X, BACK_Y, OPP_X } from './game/street';
import { createVegetation } from './world/vegetation';
import { createDecor } from './game/decor';
import { createNPCs } from './world/npcs';
import { createFolk } from './game/folk';
import { createProps } from './world/props';
import { createDresser, createGarlands } from './game/dress';
import { createPhysics } from './game/physics';
import { createHud } from './game/hud';
import { createRun } from './game/run';
import { loadQuality, PRESETS } from './game/settings';
import { createPieces } from './game/pieces';
import { createCourse } from './game/course';
import { createStorm } from './game/storm';

export type { Shared } from './stage';

const quality = loadQuality();
const Q = PRESETS[quality];
const hud = createHud(quality);

const st = createStage({ dynamicShadows: true, shadowHalf: Q.shadowHalf, fov: 52, q: Q });
const mats = createMaterials(st.U);
const kit = createArchKit(st.U, mats);
const physics = createPhysics();
const props = createProps(st.U, mats);
const dresser = createDresser(props);
const street = createStreet(st.U, mats, kit, 7, dresser.dress, physics);
street.setAhead(Q.ahead); street.setLodFar(Q.lodFar);
const garlands = createGarlands(props, { x0: 2.4, x1: OPP_X });
const veg = createVegetation(st.U, mats);
const decor = createDecor(veg, { backX: BACK_X, backY: BACK_Y, oppX: OPP_X, wallFaceX: BACK_X + 1.2 + 2 });
const npcs = createNPCs(st.U, mats);
const folk = createFolk(npcs, { oppX: OPP_X, runFacadeX: 2.4 });
st.onTick((t, dt) => { veg.update(t, dt); npcs.update(t, dt); props.update(t, dt); });
const pieces = createPieces(st.U, mats, props);
const course = createCourse(pieces as any, physics, street.segs, { oppX: OPP_X, runFacadeX: 2.4, backX: BACK_X, backY: BACK_Y }, Q.density);

const storm = createStorm(st, mats, kit, quality);
createRun(st, mats, street, hud, physics, [
  { root: decor.root, update: (z) => decor.update(z), shift: (dz) => decor.shift(dz) },
  { root: folk.root, update: (z) => folk.update(z), shift: (dz) => folk.shift(dz) },
  { root: garlands.root, update: (z) => garlands.update(z), shift: (dz) => garlands.shift(dz) },
  { root: course.root, update: (z, t) => course.update(z, t), shift: (dz) => course.shift(dz) },
], storm);
st.start();
(window as any).__quality = quality;
