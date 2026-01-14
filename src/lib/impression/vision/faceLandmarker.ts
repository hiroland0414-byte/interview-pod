// src/lib/impression/vision/faceLandmarker.ts
import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

let _landmarker: FaceLandmarker | null = null;

export async function getFaceLandmarker() {
  if (_landmarker) return _landmarker;

  // ★public/models 配下の wasm を使う（CDN依存を減らす）
  const vision = await FilesetResolver.forVisionTasks("/models/wasm");

  _landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "GPU", // だめなら "CPU" に
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });

  return _landmarker;
}
