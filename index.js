PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

let tileIndex = 0;
let saved     = localStorage.getItem('wormform');

saved = saved ? JSON.parse(saved) : [];

let renderer;
const scene = new PIXI.Container();

const TILESIZE      = innerWidth > 700 ? 64 : 48;
const TILESIZE_8THS = TILESIZE / 8;
const OFFSETS       = [0, 1, 2, 3, 4].map(o => o * .25 * TILESIZE);
const COLORS        = {
    WHITE:    0xffffff,
    BLACK:    0x000000,
    RED:      0xff0000,
    GREEN:    0x00ff00,
    BLUE:     0x0000ff,
    DEEPBLUE: 0x004488,
}

const colorFG = COLORS.WHITE;
const colorBG = COLORS.BLUE;

let isDraggingIntoTrash = false;
let trashCircle;
const ui                = (() => {
    const container = new PIXI.Container();
    const text      = new PIXI.Text('TRASH', {fontFamily: 'Arial', fontSize: 12, fill: COLORS.WHITE, align: 'center'});
    trashCircle     = new PIXI.Graphics();
    trashCircle.beginFill(COLORS.RED);
    trashCircle.drawCircle(0, 0, 120);
    trashCircle.scale.x = 0;
    trashCircle.scale.y = 0;
    trashCircle.endFill();
    container.addChild(trashCircle);
    container.addChild(text);

    text.x = -60;
    text.y = -30;

    const clearButton       = new PIXI.Graphics();
    clearButton.x           = -100;
    clearButton.y           = 0;
    clearButton.interactive = true;
    clearButton.buttonMode  = true;

    container.x = innerWidth;
    container.y = innerHeight;

    return container;
})();

const stage = new PIXI.Container();

function onDragStartStage(event) {
    this.dragging  = true;
    this.predragX  = this.x;
    this.predragY  = this.y;
    this.predragCX = event.data.global.x;
    this.predragCY = event.data.global.y;
}

function onDragMoveStage(event) {
    if (this.dragging) {
        const {x, y} = event.data.global;
        this.x       = x - this.predragCX + this.predragX;
        this.y       = y - this.predragCY + this.predragY;
    }
}

function onDragEndStage() {
    this.dragging = false;
}


scene.addChild(ui);
scene.addChild(stage);

stage.interactive = true;
stage.hitArea     = new PIXI.Rectangle(-1e4, -1e4, 2e4, 2e4);
stage.on('mousedown', onDragStartStage)
    .on('touchstart', onDragStartStage)
    .on('mouseup', onDragEndStage)
    .on('mouseupoutside', onDragEndStage)
    .on('touchend', onDragEndStage)
    .on('touchendoutside', onDragEndStage)
    .on('mousemove', onDragMoveStage)
    .on('touchmove', onDragMoveStage);

function onResize() {
    if (!renderer) {
        renderer = new PIXI.Renderer({width: innerWidth, height: innerHeight});
        document.body.appendChild(renderer.view);
    }

    ui.x = innerWidth;
    ui.y = innerHeight;
    renderer.resize(innerWidth, innerHeight);
}

function render() {
    renderer.render(scene);
}

const FPS          = 60;
const FPS_INTERVAL = 1000 / FPS;

let then = 0;
let raf;

const trashCircleGrowthRate = 0.11;

function step() {
    const now     = Date.now();
    const elapsed = now - then;

    if (elapsed > FPS_INTERVAL) {
        if (isDraggingIntoTrash) {
            if (trashCircle.scale.x < 1) {
                trashCircle.scale.x += trashCircleGrowthRate;
                trashCircle.scale.y += trashCircleGrowthRate;
            }
        } else {
            if (trashCircle.scale.x >= 0) {
                trashCircle.scale.x = Math.max(trashCircle.scale.x - trashCircleGrowthRate, 0);
                trashCircle.scale.y = Math.max(trashCircle.scale.y - trashCircleGrowthRate, 0);
            }
        }

        render();
        then = now - (elapsed % FPS_INTERVAL);
    }

    raf = requestAnimationFrame(step);
}

addEventListener('resize', onResize);
onResize();
step();

function onDragStart(event) {
    event.stopPropagation();

    // store a reference to the data
    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.data        = event.data;
    this.alpha       = 0.5;
    this.dragging    = true;
    this.predragX    = this.position.x;
    this.predragY    = this.position.y;
    this.draggedDist = 0; // cumulative, if below a certain threshold we consider it a click
}

function onDragMove(event) {
    if (this.dragging) {
        const {x, y}    = this.data.getLocalPosition(this.parent);
        this.position.x = x;
        this.position.y = y;
        this.draggedDist += Math.abs(x + this.predragX) + Math.abs(y + this.predragY);

        const {x: gx, y: gy} = event.data.global;
        isDraggingIntoTrash  = gx > innerWidth - 100 && gy > innerHeight - 100;
    }
}

function onDragEnd() {
    this.alpha    = 1;
    this.dragging = false;

    if (this.draggedDist > 8) {
        const {x, y}    = this.data.getLocalPosition(this.parent);
        this.position.x = Math.round(x / OFFSETS[2]) * OFFSETS[2];
        this.position.y = Math.round(y / OFFSETS[2]) * OFFSETS[2];
    } else {
        this.position.x = this.predragX;
        this.position.y = this.predragY;
        this.angle += 90;
    }

    this.data = null;

    if (isDraggingIntoTrash) {
        stage.removeChild(this);
        isDraggingIntoTrash = false;
        deleteSaved(this);
    } else {
        updateTileDXDY(this);
    }
}

function onTapStartOriginal(event) {
    const newTile = addTileAt(this.data, this.position.x, this.position.y);
    stage.addChild(newTile);

    onDragStart.call(newTile, event);
}

const colorBGOriginal = COLORS.DEEPBLUE;

function upsertSaved(tile) {
    const foundSaved = saved.find(s => s.id === tile.id);
    if (foundSaved) {
        foundSaved.id    = tile.id;
        foundSaved.x     = tile.x;
        foundSaved.y     = tile.y;
        foundSaved.pN    = tile.pN;
        foundSaved.angle = tile.angle % 360;
        localStorage.setItem('wormform', JSON.stringify(saved));
    } else {
        saved.push(tile);
    }
}

function deleteSaved(g) {
    const foundSavedIndex = saved.findIndex(s => s.id === g.id);
    if (foundSavedIndex >= 0) {
        saved.splice(foundSavedIndex, 1);
        localStorage.setItem('wormform', JSON.stringify(saved));
    }
}

function updateTileDXDY(g) {
    g.dx = g.x / TILESIZE - .5;
    g.dy = g.y / TILESIZE - .5;

    upsertSaved({id: g.id, x: g.dx, y: g.dy, pN: g.pN, angle: g.angle});
}

function createTile(pieceNumber, dx = 0, dy = 0, isOriginal = false, angle, lineStyle) {
    lineStyle = lineStyle || {
        width: 1,
        color: colorFG,
        alpha: 1
    };

    const g = new PIXI.Graphics();
    g.lineStyle(lineStyle.width, lineStyle.color, lineStyle.alpha);
    g.beginFill(isOriginal ? colorBGOriginal : colorBG);
    g.drawRect(0, 0, TILESIZE, TILESIZE);
    g.endFill();

    // index = piece number - 1 (from graphic)
    switch (pieceNumber) {
        case 1:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[4]);
            g.lineTo(OFFSETS[1], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[4]);
            g.lineTo(OFFSETS[1], OFFSETS[4]);
            g.endFill();
            break;
        case 2:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[0], OFFSETS[1]);
            g.arcTo(OFFSETS[3], OFFSETS[1], OFFSETS[3], OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[4]);
            g.arcTo(OFFSETS[1], OFFSETS[3], OFFSETS[0], OFFSETS[3], OFFSETS[1]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.endFill();
            break;
        case 3:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[0]);
            g.endFill();
            break;
        case 4:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[0], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.endFill();
            break;
        case 5:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[0], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[4]);
            g.lineTo(OFFSETS[1], OFFSETS[4]);
            g.lineTo(OFFSETS[1], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.endFill();
            break;
        case 6:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[0], OFFSETS[1]);
            g.arcTo(OFFSETS[3], OFFSETS[1], OFFSETS[3], OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[4]);
            g.arcTo(OFFSETS[1], OFFSETS[3], OFFSETS[0], OFFSETS[3], OFFSETS[1]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.endFill();

            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[4]);
            g.arcTo(OFFSETS[1], OFFSETS[1], OFFSETS[4], OFFSETS[1], OFFSETS[3]);
            g.lineTo(OFFSETS[4], OFFSETS[3]);
            g.arcTo(OFFSETS[3], OFFSETS[3], OFFSETS[3], OFFSETS[4], OFFSETS[1]);
            g.lineTo(OFFSETS[1], OFFSETS[4]);
            g.endFill();
            break;
        case 7:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[0] + TILESIZE_8THS, OFFSETS[1]);
            g.lineTo(OFFSETS[2] + TILESIZE_8THS, OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[4]);
            g.lineTo(OFFSETS[2], OFFSETS[4]);
            g.lineTo(OFFSETS[0] + TILESIZE_8THS, OFFSETS[1]);
            g.endFill();
            break;
        case 8:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1] + TILESIZE_8THS, OFFSETS[1]);
            g.lineTo(OFFSETS[3] + TILESIZE_8THS, OFFSETS[1]);
            g.lineTo(OFFSETS[2], OFFSETS[4]);
            g.lineTo(OFFSETS[0], OFFSETS[4]);
            g.lineTo(OFFSETS[1] + TILESIZE_8THS, OFFSETS[1]);
            g.endFill();
            break;
        case 9:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[3] + TILESIZE_8THS, OFFSETS[1]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.lineTo(OFFSETS[0], OFFSETS[3]);
            g.lineTo(TILESIZE_8THS, OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[4]);
            g.lineTo(OFFSETS[2], OFFSETS[4]);
            g.endFill();
            break;
        case 10:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[0]);
            g.lineTo(OFFSETS[4], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[0]);
            g.endFill();
            break;
        case 11:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[0]);
            g.lineTo(OFFSETS[1], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.lineTo(OFFSETS[1], OFFSETS[0]);
            g.endFill();
            break;
        case 12:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[1]);
            g.lineTo(OFFSETS[4], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[3]);
            g.lineTo(OFFSETS[3], OFFSETS[4]);
            g.lineTo(OFFSETS[1], OFFSETS[4]);
            g.lineTo(OFFSETS[1], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[3]);
            g.lineTo(OFFSETS[0], OFFSETS[1]);
            g.lineTo(OFFSETS[1], OFFSETS[1]);
            g.lineTo(OFFSETS[1], OFFSETS[0]);
            g.endFill();
            break;
        case 13:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[1], OFFSETS[1]);
            g.lineTo(OFFSETS[3], OFFSETS[1]);
            g.lineTo(OFFSETS[3], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[3]);
            g.lineTo(OFFSETS[1], OFFSETS[1]);
            g.endFill();
            break;
        case 14:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[2], OFFSETS[0]);
            g.lineTo(OFFSETS[3], OFFSETS[2]);
            g.lineTo(OFFSETS[2], OFFSETS[4]);
            g.lineTo(OFFSETS[4], OFFSETS[4]);
            g.lineTo(OFFSETS[4], OFFSETS[0]);
            g.lineTo(OFFSETS[2], OFFSETS[0]);
            g.endFill();
            break;
        case 15:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[4], OFFSETS[0]);
            g.lineTo(OFFSETS[4], OFFSETS[4]);
            g.lineTo(OFFSETS[2], OFFSETS[4]);
            g.lineTo(OFFSETS[4], OFFSETS[0]);
            g.endFill();
            break;
        case 16:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[3] + TILESIZE_8THS, OFFSETS[0]);
            g.lineTo(OFFSETS[4], OFFSETS[0]);
            g.lineTo(OFFSETS[4], OFFSETS[4]);
            g.lineTo(OFFSETS[3] + TILESIZE_8THS, OFFSETS[4]);
            g.lineTo(OFFSETS[3] + TILESIZE_8THS, OFFSETS[0]);
            g.endFill();
            break;
        case 17:
            g.beginFill(colorFG);
            g.moveTo(OFFSETS[2], OFFSETS[0]);
            g.lineTo(OFFSETS[4], OFFSETS[0]);
            g.lineTo(OFFSETS[4], OFFSETS[4]);
            g.lineTo(OFFSETS[2], OFFSETS[4]);
            g.lineTo(OFFSETS[2], OFFSETS[0]);
            g.endFill();
            break;
    }

    g.x = dx;
    g.y = dy;

    g.interactive = true;
    g.buttonMode  = true;

    if (isOriginal) {
        g.data   = pieceNumber;
        g.zIndex = -1;

        g
            .on('mousedown', onTapStartOriginal)
            .on('touchstart', onTapStartOriginal);
    } else {
        g.pivot.x = g.pivot.y = OFFSETS[2];
        g.angle   = angle;

        g.id = tileIndex;
        g.pN = pieceNumber;
        tileIndex++;

        updateTileDXDY(g);

        g
            .on('mousedown', onDragStart)
            .on('touchstart', onDragStart)
            .on('mouseup', onDragEnd)
            .on('mouseupoutside', onDragEnd)
            .on('touchend', onDragEnd)
            .on('touchendoutside', onDragEnd)
            .on('mousemove', onDragMove)
            .on('touchmove', onDragMove);
    }

    return g;
}

function addTileAt(pN, x, y, angle = 0, isOriginal) {
    const t = createTile(pN, (x + .5) * TILESIZE, (y + .5) * TILESIZE, isOriginal, angle);

    if (isOriginal) {
        scene.addChild(t);
    } else {
        stage.addChild(t);
    }

    return t;
}

for (let i = 0; i < 2; i++) {
    for (let j = 1; j <= 9; j++) {
        addTileAt(j + 9 * i, i - .5, j - 1.5, 0, true);
    }
}

for (let i of saved) {
    addTileAt(i.pN, i.x, i.y, i.angle);
    tileIndex = Math.max(i.id, tileIndex);
}

// A
/*
addTileAt(2, 3, 1, -90);
addTileAt(2, 4, 1,);
addTileAt(4, 3, 2, 90);
addTileAt(4, 4, 2, 90);
addTileAt(5, 3, 3, -90);
addTileAt(5, 4, 3, 90);
addTileAt(3, 3, 4, 0);
addTileAt(3, 4, 4, 0);
*/
