// 地块类
class Tile {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 地形类型
        
        this.owner = null;
        this.unit = null;
        this.building = null;
    }
}

// 边境类 (独立物体)
class Edge {
    constructor(x, y, orientation) {
        this.x = x;
        this.y = y;
        this.orientation = orientation; // 'H' (横向) 或 'V' (纵向)
        this.type = 'PLAIN'; // 默认为平原边
    }
}

class Player {
    constructor(id, color, isAI) {
        this.id = id;
        this.color = color;
        this.isAI = isAI;
        this.state = 'TRIBE';
        this.food = 5;
        this.foodCap = 0;
        this.soldierPoints = 0;
        this.soldierCap = 0;
    }
}