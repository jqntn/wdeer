import "@babylonjs/loaders/glTF/2.0"; // registers the glTF 2.0 loader plugin
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Scene } from "@babylonjs/core/scene";
import { Config } from "./Config";

/** Preloads glTF assets into reusable AssetContainers (instanced per entity). */
export class AssetManager {
  deer!: AssetContainer;

  async load(scene: Scene): Promise<void> {
    this.deer = await LoadAssetContainerAsync(Config.assets.deerModel, scene);
  }
}
