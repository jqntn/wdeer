import HavokPhysics from "@babylonjs/havok";
// Side effects: register Scene.enablePhysics/getPhysicsEngine (joined) and the
// TransformNode.physicsBody accessors (v2).
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { Config } from "./Config";

/**
 * Load the Havok WASM module and enable the physics v2 plugin on the scene.
 * Returns the plugin so systems can run raycasts/queries directly.
 */
export async function initPhysics(scene: Scene): Promise<HavokPlugin> {
  const havok = await HavokPhysics();
  const plugin = new HavokPlugin(true, havok);
  const ok = scene.enablePhysics(new Vector3(0, Config.physics.gravity, 0), plugin);
  if (!ok || !scene.getPhysicsEngine()) {
    throw new Error("Havok physics failed to initialise (enablePhysics returned false).");
  }
  return plugin;
}
