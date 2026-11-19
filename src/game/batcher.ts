// Agrupa las mallas de muchos edificios en un BatchedMesh por material: con decenas de casas
// en pantalla pasa de cientos de llamadas de dibujo a una por material.
// Uso: register(grupo) al construir la piscina → build() una vez → place()/hide() al reciclar.
import * as THREE from 'three';

export type Ref = { batch: THREE.BatchedMesh | null; id: number; rel: THREE.Matrix4; detail: boolean; mesh: THREE.Mesh };
export type Refs = { refs: Ref[]; fallback: THREE.Group | null; small: THREE.Object3D[]; big: THREE.Mesh[]; dress: THREE.Object3D[] };

type Entry = { mesh: THREE.Mesh; ref: Ref };

export function createBatcher(root: THREE.Object3D, enabled = true) {
  const groups = new Map<string, Entry[]>();
  const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

  /** Registra las mallas de un edificio. `group` debe estar sin posicionar (solo con su rotación). */
  function register(group: THREE.Group): Refs {
    const rot = group.rotation.clone(), pos = group.position.clone();
    group.position.set(0, 0, 0); group.rotation.set(0, 0, 0); group.updateMatrixWorld(true);
    const out: Refs = { refs: [], fallback: null, small: [], big: [], dress: [] };
    const keep: THREE.Mesh[] = [];
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as any).isInstancedMesh || (m as any).isSkinnedMesh || !enabled) { if (m.isMesh) keep.push(m); return; }
      if (Array.isArray(m.material)) { keep.push(m); return; }
      const g = m.geometry;
      const sig = Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(',') + (g.index ? 'i' : 'n');
      const key = (m.material as THREE.Material).uuid + '|' + sig;
      const basic = (m.material as THREE.Material).type === 'MeshBasicMaterial';
      const t = tris(g);
      const ref: Ref = { batch: null, id: -1, rel: m.matrixWorld.clone(), detail: !(basic && t >= 40) && t < 150, mesh: m };
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ mesh: m, ref });
      out.refs.push(ref);
    });
    group.rotation.copy(rot); group.position.copy(pos);
    // lo que no se puede agrupar se queda en el grupo original
    const drop: THREE.Object3D[] = [];
    group.traverse((o) => { if ((o as THREE.Mesh).isMesh && !keep.includes(o as THREE.Mesh)) drop.push(o); });
    for (const o of drop) o.parent?.remove(o);
    if (keep.length) {
      out.fallback = group; group.visible = false; root.add(group);
      for (const c of group.children) if (c.userData.dress) out.dress.push(c);
      for (const m of keep) {
        const t = tris(m.geometry), basic = (m.material as THREE.Material).type === 'MeshBasicMaterial';
        m.receiveShadow = true; m.castShadow = false;
        if (t >= 400 && !basic) out.big.push(m);
        let dressed = false; for (let p: THREE.Object3D | null = m; p && p !== group; p = p.parent) if (p.userData.dress) dressed = true;
        if (!dressed && !(basic && t >= 40) && t < 400) out.small.push(m);
      }
    }
    return out;
  }

  function build() {
    for (const list of groups.values()) {
      const geos = new Map<string, { geo: THREE.BufferGeometry; id: number }>();
      let verts = 0, index = 0;
      for (const e of list) {
        const g = e.mesh.geometry;
        if (geos.has(g.uuid)) continue;
        geos.set(g.uuid, { geo: g, id: -1 });
        verts += g.attributes.position.count; index += g.index ? g.index.count : 0;
      }
      const mat = list[0].mesh.material as THREE.Material;
      const batch = new THREE.BatchedMesh(list.length, verts, Math.max(index, 1), mat);
      batch.receiveShadow = true;
      batch.castShadow = list.some((e) => tris(e.mesh.geometry) >= 400 && mat.type !== 'MeshBasicMaterial');
      batch.sortObjects = false;
      for (const v of geos.values()) v.id = batch.addGeometry(v.geo);
      for (const e of list) {
        const id = batch.addInstance(geos.get(e.mesh.geometry.uuid)!.id);
        batch.setVisibleAt(id, false);
        e.ref.batch = batch; e.ref.id = id;
      }
      root.add(batch);
    }
    groups.clear();
  }

  const M = new THREE.Matrix4(), W = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
  /** Coloca un edificio: posición y giro en Y del conjunto; lod 2 oculta los detalles pequeños. */
  function place(r: Refs, pos: THREE.Vector3, rotY: number, lod: number) {
    Q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY);
    W.compose(pos, Q, S);
    for (const ref of r.refs) {
      if (!ref.batch) continue;
      M.multiplyMatrices(W, ref.rel);
      ref.batch.setMatrixAt(ref.id, M);
      ref.batch.setVisibleAt(ref.id, !(ref.detail && lod >= 2));
    }
    if (r.fallback) { r.fallback.position.copy(pos); r.fallback.rotation.set(0, rotY, 0); r.fallback.visible = true; r.fallback.updateMatrixWorld(true); }
  }
  function setLod(r: Refs, lod: number) {
    if (r.fallback) { for (const m of r.small) m.visible = lod < 2; for (const d of r.dress) d.visible = lod < 1.5; for (const m of r.big) m.castShadow = lod === 0; }
    for (const ref of r.refs) if (ref.batch && ref.detail) ref.batch.setVisibleAt(ref.id, lod < 2);
  }
  function hide(r: Refs) {
    for (const ref of r.refs) if (ref.batch) ref.batch.setVisibleAt(ref.id, false);
    if (r.fallback) r.fallback.visible = false;
  }
  return { register, build, place, setLod, hide };
}
