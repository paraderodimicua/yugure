// Guardián de cámara: oculta los adornos grandes (árboles, masas de bosque, piezas del recorrido) mientras
// envuelven o rozan la cámara. Sin él, la cámara puede quedar dentro de una copa o de una tarjeta de
// follaje y la pantalla se llena de un color plano durante un instante.
import * as THREE from 'three';

type Tracked = { o: THREE.Object3D; s: THREE.Sphere; moving: boolean; hidden: boolean };

export function createCamGuard(cam: THREE.Object3D, margin = 0.9, radiusK = 0.8) {
  const items = new Map<THREE.Object3D, Tracked>();
  const B = new THREE.Box3();
  const sphereOf = (o: THREE.Object3D, out: THREE.Sphere) => {
    o.updateMatrixWorld(true);
    B.setFromObject(o);
    B.getBoundingSphere(out);
    out.radius *= radiusK;           // la esfera envolvente sobra por las esquinas
    return out;
  };
  return {
    /** registrar un adorno recién colocado; moving = recalcular su esfera cada fotograma */
    track(o: THREE.Object3D, moving = false) {
      const t = items.get(o) ?? { o, s: new THREE.Sphere(), moving, hidden: false };
      t.moving = moving; t.hidden = false; sphereOf(o, t.s); items.set(o, t);
    },
    /** dejar de vigilarlo (al reciclarlo); su visibilidad la decide quien lo recicla */
    untrack(o: THREE.Object3D) { items.delete(o); },
    /** recalcular tras mover (origen flotante) */
    refresh() { for (const t of items.values()) sphereOf(t.o, t.s); },
    update() {
      const p = cam.position;
      for (const t of items.values()) {
        if (t.moving) sphereOf(t.o, t.s);
        const near = t.s.center.distanceTo(p) < t.s.radius + margin;
        if (near !== t.hidden) { t.hidden = near; t.o.visible = !near; }
      }
    },
  };
}
export type CamGuard = ReturnType<typeof createCamGuard>;
