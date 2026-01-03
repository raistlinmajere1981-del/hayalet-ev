import Konva from "konva";

export class TestKonvaController {
  init() {
    const stage = new Konva.Stage({
      container: "konva-container",
      width: 400,
      height: 200,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const rect = new Konva.Rect({
      x: 50,
      y: 50,
      width: 100,
      height: 50,
      fill: "green",
      stroke: "black",
      strokeWidth: 4,
    });
    layer.add(rect);

    layer.draw();
    console.log("Konva test page initialized and shape drawn.");
  }

  onShow() {
    console.log("Konva test page shown.");
  }

  onHide() {
    console.log("Konva test page hidden.");
  }
}
