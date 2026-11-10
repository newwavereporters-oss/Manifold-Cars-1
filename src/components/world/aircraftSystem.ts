
import * as THREE from "three";

export class AircraftSystem {
  public group = new THREE.Group();

  private takeoffJet = new THREE.Group();
  private distantJet = new THREE.Group();
  private landingGear = new THREE.Group();

  private elapsed = 0;
  private distantElapsed = 0;
  private airborne = false;

  private readonly runwayZ = -220;
  private readonly startX = -175;
  private readonly takeoffX = -45;

  constructor() {
    this.buildAirport();
    this.buildPassengerJet(this.takeoffJet, true);
    this.buildPassengerJet(this.distantJet, false);

    this.takeoffJet.add(this.landingGear);

    this.takeoffJet.position.set(
      this.startX,
      2.1,
      this.runwayZ
    );

    this.distantJet.position.set(-30, 42, -315);
    this.distantJet.rotation.y = Math.PI / 2;
    this.distantJet.rotation.x = -0.04;
    this.distantJet.scale.setScalar(0.58);

    this.group.add(this.takeoffJet);
    this.group.add(this.distantJet);
  }

  private buildAirport() {
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x65735d,
      roughness: 1,
    });

    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x30343a,
      roughness: 0.95,
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x858b91,
      roughness: 0.9,
    });

    const whiteMat = new THREE.MeshBasicMaterial({
      color: 0xf4f5ef,
    });

    const yellowMat = new THREE.MeshBasicMaterial({
      color: 0xffd34e,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x315a70,
      roughness: 0.25,
      metalness: 0.2,
    });

    // Airport apron and surrounding grass
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(370, 100),
      groundMat
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-35, -0.15, -190);
    this.group.add(apron);

    // Long runway aligned with the takeoff direction (+X)
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 24),
      runwayMat
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(-35, 0.02, this.runwayZ);
    this.group.add(runway);

    // Runway centerline dashes
    for (let x = -185; x <= 110; x += 16) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 0.28),
        whiteMat
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.05, this.runwayZ);
      this.group.add(dash);
    }

    // Threshold stripes at both runway ends
    for (const endX of [-190, 120]) {
      for (let i = -4; i <= 4; i++) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 5),
          whiteMat
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(endX, 0.055, this.runwayZ + i * 1.8);
        this.group.add(stripe);
      }
    }

    // Yellow taxiway running alongside the runway
    const taxiway = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 8),
      concreteMat
    );
    taxiway.rotation.x = -Math.PI / 2;
    taxiway.position.set(-65, 0.025, -200);
    this.group.add(taxiway);

    const taxiLine = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 0.2),
      yellowMat
    );
    taxiLine.rotation.x = -Math.PI / 2;
    taxiLine.position.set(-65, 0.06, -200);
    this.group.add(taxiLine);

    // Terminal building
    const terminal = new THREE.Mesh(
      new THREE.BoxGeometry(48, 8, 13),
      concreteMat
    );
    terminal.position.set(-85, 4, -181);
    this.group.add(terminal);

    // Terminal glass frontage
    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(44, 4.3, 0.2),
      glassMat
    );
    windows.position.set(-85, 3.5, -174.35);
    this.group.add(windows);

    // Terminal roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(51, 0.8, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe5e7eb,
        roughness: 0.8,
      })
    );
    roof.position.set(-85, 8.4, -181);
    this.group.add(roof);

    // Air traffic control tower
    const tower = new THREE.Group();

    const towerBase = new THREE.Mesh(
      new THREE.BoxGeometry(4, 17, 4),
      concreteMat
    );
    towerBase.position.y = 8.5;
    tower.add(towerBase);

    const controlRoom = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3.5, 8),
      glassMat
    );
    controlRoom.position.y = 18.5;
    tower.add(controlRoom);

    const towerRoof = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.6, 9),
      concreteMat
    );
    towerRoof.position.y = 20.6;
    tower.add(towerRoof);

    tower.position.set(-118, 0, -183);
    this.group.add(tower);

    // Low runway edge lights
    const lightMat = new THREE.MeshBasicMaterial({
      color: 0x9bdcff,
    });

    for (const side of [-1, 1]) {
      for (let x = -185; x <= 115; x += 15) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.25, 0.35),
          lightMat
        );
        light.position.set(x, 0.2, this.runwayZ + side * 12.5);
        this.group.add(light);
      }
    }

    // Taxiway connector markings
    for (let x = -155; x < -100; x += 12) {
      const mark = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 0.22),
        yellowMat
      );
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(x, 0.06, -200);
      this.group.add(mark);
    }
  }

  private buildPassengerJet(
    aircraft: THREE.Group,
    withLandingGear: boolean
  ) {
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0xf1f3f5,
      roughness: 0.38,
      metalness: 0.12,
    });

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xcbd2da,
      roughness: 0.48,
      metalness: 0.18,
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x202a35,
      roughness: 0.45,
    });

    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x153b53,
    });

    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x6b7480,
      metalness: 0.55,
      roughness: 0.35,
    });

    // Aircraft nose points along local +Z.
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.95, 15, 12),
      fuselageMat
    );
    fuselage.rotation.x = Math.PI / 2;
    aircraft.add(fuselage);

    // Rounded forward nose
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 12, 8),
      fuselageMat
    );
    nose.scale.set(0.9, 0.7, 1.25);
    nose.position.z = 7.25;
    aircraft.add(nose);

    // Tail cone
    const tailCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 2.5, 10),
      fuselageMat
    );
    tailCone.rotation.x = -Math.PI / 2;
    tailCone.position.z = -8.2;
    aircraft.add(tailCone);

    // Main swept wings
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.22, 3.4),
      wingMat
    );
    wings.position.set(0, -0.1, -0.4);
    wings.rotation.y = 0.04;
    aircraft.add(wings);

    // Rear horizontal stabilizers
    const tailplane = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.15, 2),
      wingMat
    );
    tailplane.position.set(0, 0.1, -6.4);
    aircraft.add(tailplane);

    // Vertical tail fin
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3, 3),
      fuselageMat
    );
    fin.position.set(0, 1.3, -6.4);
    aircraft.add(fin);

    // Two underwing jet engines
    for (const side of [-1, 1]) {
      const engine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.8, 3.1, 12),
        engineMat
      );
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 5.1, -0.85, -0.1);
      aircraft.add(engine);

      const intake = new THREE.Mesh(
        new THREE.CircleGeometry(0.56, 12),
        darkMat
      );
      intake.position.set(side * 5.1, -0.85, 1.47);
      aircraft.add(intake);
    }

    // Passenger cabin windows on both sides
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i++) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.19, 0.22),
          windowMat
        );

        windowMesh.position.set(
          side * 0.79,
          0.25,
          -4.8 + i * 0.78
        );

        aircraft.add(windowMesh);
      }
    }

    // Cockpit windows
    for (const side of [-1, 1]) {
      const cockpit = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.35, 1.1),
        windowMat
      );
      cockpit.position.set(side * 0.55, 0.42, 6.3);
      aircraft.add(cockpit);
    }

    if (withLandingGear) {
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x17191c,
        roughness: 0.85,
      });

      // Front landing gear
      this.addWheel(this.landingGear, -0.2, -1.45, 4.5, wheelMat);

      // Main landing gear assemblies
      for (const side of [-1, 1]) {
        this.addWheel(
          this.landingGear,
          side * 2.1,
          -1.5,
          -2,
          wheelMat
        );
      }

      aircraft.add(this.landingGear);
    }
  }

  private addWheel(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    material: THREE.Material
  ) {
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.85, 6),
      material
    );
    strut.position.set(x, y + 0.4, z);
    parent.add(strut);

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.18, 10),
      material
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    parent.add(wheel);
  }

  public update(delta: number) {
    this.elapsed += delta;
    this.distantElapsed += delta;

    // Aircraft 1: accelerate down the runway.
    const taxiSpeed = 18;
    const runwayDistance = this.takeoffX - this.startX;
    const runwayProgress = Math.min(
      (this.elapsed * taxiSpeed) / runwayDistance,
      1
    );

    const x = this.startX + runwayDistance * runwayProgress;

    this.takeoffJet.position.x = x;
    this.takeoffJet.position.z = this.runwayZ;

    // Keep the aircraft on the runway before rotation.
    if (runwayProgress < 1) {
      this.takeoffJet.position.y = 2.1;
      this.takeoffJet.rotation.set(0, Math.PI / 2, 0);
    } else {
      // Rotate nose upward, then climb smoothly.
      this.airborne = true;

      const climbTime = this.elapsed -
        runwayDistance / taxiSpeed;

      const pitch = Math.min(climbTime * 0.11, 0.23);

      this.takeoffJet.rotation.set(
        -pitch,
        Math.PI / 2,
        0
      );

      this.takeoffJet.position.y =
        2.1 + Math.min(climbTime * 5.2, 52);

      this.takeoffJet.position.x += climbTime * 8;

      // Retract landing gear after liftoff.
      if (climbTime > 1.8) {
        this.landingGear.visible = false;
      }
    }

    // Aircraft 2: another jet already airborne, farther away.
    this.distantJet.position.x += delta * 13;
    this.distantJet.position.y =
      42 + Math.sin(this.distantElapsed * 0.35) * 1.2;

    // Reset both flights for continuous world activity.
    if (this.takeoffJet.position.x > 235) {
      this.elapsed = 0;
      this.airborne = false;
      this.landingGear.visible = true;
      this.takeoffJet.position.set(
        this.startX,
        2.1,
        this.runwayZ
      );
      this.takeoffJet.rotation.set(0, 0, 0);
    }

    if (this.distantJet.position.x > 235) {
      this.distantJet.position.set(-180, 42, -315);
      this.distantElapsed = 0;
    }
  }
}
