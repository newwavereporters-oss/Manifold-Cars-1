
import * as THREE from "three";

export class BirdsSystem {
  public group = new THREE.Group();

  private birds: THREE.Group[] = [];
  private elapsed = 0;

  constructor() {
    const birdCount = 7;

    const featherMaterial = new THREE.MeshBasicMaterial({
      color: 0x252d36,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < birdCount; i++) {
      const bird = new THREE.Group();

      // Body
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 5),
        featherMaterial
      );
      body.scale.set(1.5, 0.65, 0.65);
      bird.add(body);

      // Wings
      const wingGeometry = new THREE.BufferGeometry();
      wingGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [0, 0, 0, -0.65, 0, -0.2, -0.2, 0.04, 0.45,
           0, 0, 0, 0.65, 0, -0.2, 0.2, 0.04, 0.45],
          3
        )
      );
      wingGeometry.computeVertexNormals();

      const leftWing = new THREE.Mesh(
        wingGeometry,
        featherMaterial
      );

      leftWing.position.y = 0.05;
      bird.add(leftWing);

      bird.position.set(
        -100 + i * 12,
        35 + (i % 3) * 4,
        -150 - (i % 4) * 15
      );

      bird.userData.phase = i * 0.9;
      bird.userData.leftWing = leftWing;

      this.birds.push(bird);
      this.group.add(bird);
    }
  }

  public update(delta: number) {
    this.elapsed += delta;

    this.birds.forEach((bird) => {
      const phase = this.elapsed * 7 + bird.userData.phase;

      bird.position.x += delta * 5;
      bird.position.y += Math.sin(phase) * delta * 0.8;

      // Subtle banking and wing movement
      bird.rotation.z = Math.sin(phase * 0.5) * 0.12;
      bird.userData.leftWing.rotation.x =
        Math.sin(phase) * 0.35;

      // Return birds to the beginning of their flight path
      if (bird.position.x > 120) {
        bird.position.x = -120;
      }
    });
  }
}
