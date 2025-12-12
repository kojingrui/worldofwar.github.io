class Game {
    constructor(size) {
        this.size = size;
        this.tiles = [];
        this.hEdges = []; // 横向边数组 (size+1) * size
        this.vEdges = []; // 纵向边数组 size * (size+1)
        this.players = [];
        
        this.initData();
        this.generateTerrain();
        this.initPlayers();
        this.spawnPlayers();
        
        this.render(); // 渲染现在只做一次 DOM 生成
        this.updateUI();
    }

    // 1. 初始化空数据结构
    initData() {
        // 创建地块
        for (let y = 0; y < this.size; y++) {
            const row = [];
            for (let x = 0; x < this.size; x++) {
                row.push(new Tile(x, y, 'PLAIN'));
            }
            this.tiles.push(row);
        }

        // 创建横向边 (行数 = size + 1)
        for (let y = 0; y <= this.size; y++) {
            const row = [];
            for (let x = 0; x < this.size; x++) {
                row.push(new Edge(x, y, 'H'));
            }
            this.hEdges.push(row);
        }

        // 创建纵向边 (列数 = size + 1)
        for (let y = 0; y < this.size; y++) {
            const row = [];
            for (let x = 0; x <= this.size; x++) {
                row.push(new Edge(x, y, 'V'));
            }
            this.vEdges.push(row);
        }
    }

    // 2. 地形生成算法 (核心逻辑修改)
    generateTerrain() {
        // A. 随机地块地形
        for(let y=0; y<this.size; y++) {
            for(let x=0; x<this.size; x++) {
                this.tiles[y][x].type = this.randomTerrainType();
            }
        }

        // B. 生成山脉边 (规则：连接其他山脉或高山)
        // 简单策略：如果你在两个高山/山脉地块之间，你大概率是山脉边
        const trySetMountainEdge = (edge, tile1, tile2) => {
            const isHigh = (t) => t && (t.type === 'MOUNTAIN' || t.type === 'DESERT'); // 假设沙漠也算比较高或干旱
            // 如果两边都是高山，90%概率变成山脉边
            if (isHigh(tile1) && isHigh(tile2)) {
                if (Math.random() < 0.9) edge.type = 'MOUNTAIN';
            }
            // 如果一边是高山，30%概率延伸出山脉边
            else if (isHigh(tile1) || isHigh(tile2)) {
                if (Math.random() < 0.3) edge.type = 'MOUNTAIN';
            }
        };

        // 遍历所有横向边
        for (let y = 1; y < this.size; y++) { // 跳过边界
            for (let x = 0; x < this.size; x++) {
                trySetMountainEdge(this.hEdges[y][x], this.tiles[y-1][x], this.tiles[y][x]);
            }
        }
        // 遍历所有纵向边
        for (let y = 0; y < this.size; y++) {
            for (let x = 1; x < this.size; x++) {
                trySetMountainEdge(this.vEdges[y][x], this.tiles[y][x-1], this.tiles[y][x]);
            }
        }

        // C. 生成河流 (爬虫算法)
        // 规则：必须从山脉/湖泊/边缘流出，且连续
        const riverSources = this.findPotentialRiverSources();
        const riverCount = Math.floor(this.size * 1.5); // 比如 8*8 地图生成 12 条河

        for (let i = 0; i < riverCount; i++) {
            if (riverSources.length === 0) break;
            
            // 随机选一个源头
            const sourceIndex = Math.floor(Math.random() * riverSources.length);
            const startEdge = riverSources[sourceIndex];
            
            this.growRiver(startEdge);
        }
    }

    randomTerrainType() {
        const r = Math.random();
        if (r < CONFIG.terrainProb[0]) return 'PLAIN';
        if (r < CONFIG.terrainProb[1]) return 'MOUNTAIN';
        if (r < CONFIG.terrainProb[2]) return 'DESERT';
        if (r < CONFIG.terrainProb[3]) return 'LAKE';
        return 'FOREST';
    }

    // 寻找河流源头：所有接触到 山脉、湖泊 或 地图边缘 的边
    findPotentialRiverSources() {
        let sources = [];
        
        const isWaterSource = (t) => t.type === 'MOUNTAIN' || t.type === 'LAKE';

        // 检查横向边
        for (let y = 0; y <= this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const edge = this.hEdges[y][x];
                // 边界
                if (y === 0 || y === this.size) { sources.push(edge); continue; }
                // 内部：检查上下地块
                const t1 = this.tiles[y-1][x];
                const t2 = this.tiles[y][x];
                if (isWaterSource(t1) || isWaterSource(t2)) sources.push(edge);
            }
        }
        // 检查纵向边
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x <= this.size; x++) {
                const edge = this.vEdges[y][x];
                if (x === 0 || x === this.size) { sources.push(edge); continue; }
                const t1 = this.tiles[y][x-1];
                const t2 = this.tiles[y][x];
                if (isWaterSource(t1) || isWaterSource(t2)) sources.push(edge);
            }
        }
        return sources;
    }

    // 河流生长逻辑
    growRiver(startEdge) {
        let current = startEdge;
        let length = 0;
        const maxLength = 10; // 河流最大长度

        while (current && length < maxLength) {
            // 如果已经是河了，或者是山脉，就停止（或汇流）
            if (current.type === 'RIVER') break; 
            if (current.type === 'MOUNTAIN') break; 

            // 变成河流
            current.type = 'RIVER';
            
            // 寻找下一个连接的边
            current = this.getNextRiverEdge(current);
            length++;
        }
    }

    // 获取下一个可流动的邻接边
    getNextRiverEdge(edge) {
        // 这是一个简化的拓扑查找，找到当前边端点连接的其他边
        // 为了省事，我们随机找一个邻居，不走回头路
        const neighbors = this.getConnectedEdges(edge);
        // 过滤掉已经是河流的边（防止倒流太严重，虽然现实中会汇流，这里简化）
        const validNeighbors = neighbors.filter(e => e.type !== 'RIVER' && e.type !== 'MOUNTAIN');
        
        if (validNeighbors.length === 0) return null;
        return validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
    }

    // 获取某个边连接的所有其他边 (拓扑结构)
    getConnectedEdges(edge) {
        let list = [];
        // 如果是横向边 (x, y)，它连接左端点(x,y)和右端点(x+1,y)的纵向边
        if (edge.orientation === 'H') {
            const x = edge.x; 
            const y = edge.y;
            // 左端点连接的纵向边: V(x, y-1) 和 V(x, y)
            if (y > 0) list.push(this.vEdges[y-1][x]); // 上
            if (y < this.size) list.push(this.vEdges[y][x]); // 下
            
            // 右端点连接的纵向边: V(x+1, y-1) 和 V(x+1, y)
            if (y > 0) list.push(this.vEdges[y-1][x+1]); // 上
            if (y < this.size) list.push(this.vEdges[y][x+1]); // 下
        } 
        // 如果是纵向边 (x, y)
        else {
            const x = edge.x;
            const y = edge.y;
            // 上端点连接的横向边: H(x-1, y) 和 H(x, y)
            if (x > 0) list.push(this.hEdges[y][x-1]);
            if (x < this.size) list.push(this.hEdges[y][x]);
            
            // 下端点连接的横向边: H(x-1, y+1) 和 H(x, y+1)
            if (x > 0) list.push(this.hEdges[y+1][x-1]);
            if (x < this.size) list.push(this.hEdges[y+1][x]);
        }
        
        // 过滤掉 undefined (边界外)
        return list.filter(e => e !== undefined);
    }

    initPlayers() {
        this.players.push(new Player(1, '#ff4444', false));
        this.players.push(new Player(2, '#4444ff', true));
    }

    spawnPlayers() {
        // 简单的随机出生，避开平原
        this.players.forEach(p => {
            let done = false;
            while(!done) {
                let x = Math.floor(Math.random()*this.size);
                let y = Math.floor(Math.random()*this.size);
                let t = this.tiles[y][x];
                if(t.type !== 'PLAIN' && !t.owner) {
                    t.owner = p.id;
                    t.building = {type:'稻田'};
                    t.unit = {type:'步兵'};
                    done = true;
                }
            }
        });
    }

    // 3. 全新的渲染引擎：基于 Grid 的交错布局
    render() {
        const board = document.getElementById('game-board');
        board.innerHTML = '';

        // 定义 CSS Grid 的列模版：Edge - Tile - Edge - Tile ...
        // 比如 8x8，需要 17 列 (8个地块 + 9条竖边)
        let colTemplate = '';
        for(let i=0; i<this.size; i++) colTemplate += `var(--edge-thick) var(--tile-size) `;
        colTemplate += `var(--edge-thick)`;
        board.style.gridTemplateColumns = colTemplate;

        // 构建 DOM 结构
        // 我们一行一行构建：
        // 第 0 行：角落 - 横边 - 角落 - 横边 ...
        // 第 1 行：纵边 - 地块 - 纵边 - 地块 ...
        // 第 2 行：角落 - 横边 ...
        
        for (let rowStep = 0; rowStep <= this.size * 2; rowStep++) {
            
            const isEdgeRow = (rowStep % 2 === 0); // 偶数行全是横边
            const y = Math.floor(rowStep / 2);

            if (isEdgeRow) {
                // --- 横边行 ---
                for (let colStep = 0; colStep <= this.size * 2; colStep++) {
                    const isCorner = (colStep % 2 === 0);
                    const x = Math.floor(colStep / 2);

                    const el = document.createElement('div');
                    el.className = 'game-obj';

                    if (isCorner) {
                        el.classList.add('corner');
                    } else {
                        // 这是横边 hEdges[y][x]
                        const edge = this.hEdges[y][x];
                        el.classList.add('edge', 'edge-h', `edge-type-${edge.type.toLowerCase()}`);
                        el.title = `横边 ${edge.type}`;
                    }
                    board.appendChild(el);
                }
            } else {
                // --- 地块行 ---
                for (let colStep = 0; colStep <= this.size * 2; colStep++) {
                    const isVerticalEdge = (colStep % 2 === 0);
                    const x = Math.floor(colStep / 2);

                    const el = document.createElement('div');
                    el.className = 'game-obj';

                    if (isVerticalEdge) {
                        // 这是纵边 vEdges[y][x]
                        const edge = this.vEdges[y][x];
                        el.classList.add('edge', 'edge-v', `edge-type-${edge.type.toLowerCase()}`);
                        el.title = `纵边 ${edge.type}`;
                    } else {
                        // 这是地块 tiles[y][x]
                        const tile = this.tiles[y][x];
                        el.classList.add('tile', `terrain-${tile.type.toLowerCase()}`);
                        el.onclick = () => alert(`地块: ${tile.type}`);

                        // 渲染内容
                        if (tile.owner) {
                            const p = this.players.find(pl => pl.id === tile.owner);
                            el.innerHTML += `<div class="player-badge" style="background:${p.color}"></div>`;
                        }
                        if (tile.unit) el.innerHTML += `<div class="unit-icon">🛡️</div>`;
                        if (tile.building) el.innerHTML += `<div class="building-icon">🌾</div>`;
                    }
                    board.appendChild(el);
                }
            }
        }
    }

    updateUI() {
        // 简单的UI更新
    }
}