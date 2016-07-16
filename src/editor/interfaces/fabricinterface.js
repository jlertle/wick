/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

var FabricInterface = function (wickEditor) {

    var that = this;

// Setup fabric canvas

    this.canvas = new fabric.CanvasEx('fabricCanvas');
    this.canvas.selectionColor = 'rgba(0,0,5,0.1)';
    this.canvas.selectionBorderColor = 'grey';
    this.canvas.selectionLineWidth = 2;
    this.canvas.backgroundColor = "#EEE";
    this.canvas.setWidth ( window.innerWidth  );
    this.canvas.setHeight( window.innerHeight );

    this.context = this.canvas.getContext('2d');

    this.canvasPanPosition = {x:0,y:0};

    this.currentTool = "cursor";

// Editor state syncing

    this.getFrameOffset = function () {
        return {
            x: (window.innerWidth  - wickEditor.project.resolution.x)/2 + that.canvasPanPosition.x,
            y: (window.innerHeight - wickEditor.project.resolution.y)/2 + that.canvasPanPosition.y
        }
    }

    this.syncObject = function (wickObj, fabricObj) {

        fabricObj.left    = wickObj.x + this.getFrameOffset().x;
        fabricObj.top     = wickObj.y + this.getFrameOffset().y;
        fabricObj.width   = wickObj.width;
        fabricObj.height  = wickObj.height;
        fabricObj.scaleX  = wickObj.scaleX;
        fabricObj.scaleY  = wickObj.scaleY;
        fabricObj.angle   = wickObj.angle;
        fabricObj.flipX   = wickObj.flipX;
        fabricObj.flipY   = wickObj.flipY;
        fabricObj.opacity = wickObj.opacity;

        fabricObj.setCoords();

    }

    this.createFabricObjectFromWickObject = function (wickObj, callback) {

        if(wickObj.imageData) {
            fabric.Image.fromURL(wickObj.imageData, function(newFabricImage) {
                that.syncObject(wickObj, newFabricImage);
                callback(newFabricImage);
            });
        }

        if(wickObj.fontData) {
            var newFabricText = new fabric.Text(wickObj.fontData.text, wickObj.fontData);
            that.syncObject(wickObj, newFabricText);
            callback(newFabricText);
        }

        if(wickObj.audioData) {
            fabric.Image.fromURL('resources/audio.png', function(audioFabricObject) {
                that.syncObject(wickObj, audioFabricObject);
                callback(audioFabricObject);
            });
        }

        if (wickObj.isSymbol) {
            console.error("alright lets do it");
            fabric.Image.fromURL(wickObj.frames[0].wickObjects[0].imageData, function(newFabricImage) {
                that.syncObject(wickObj, newFabricImage);
                callback(newFabricImage);
            });
        }

    }

    this.objectWithIDExistsInCanvas = function (id) {
        var found = false;

        this.canvas.forEachObject(function(fabricObj) {
            if(fabricObj.wickObjectID == id) {
                found = true;
            }
        });

        return found;
    }

    this.syncWithEditorState = function () {
        this.frameInside.fill = wickEditor.project.backgroundColor;

        var currentObject = wickEditor.project.getCurrentObject();

        // Make sure everything is deselected, mulitple selected objects cause positioning problems.
        var selectedObjectIDs = that.getSelectedObjectIDs();
        that.deselectAll();

        // Remove objects that don't exist anymore
        this.canvas.forEachObject(function(fabricObj) {
            if(!fabricObj.wickObjectID) return;

            if(!currentObject.childWithIDIsActive(fabricObj.wickObjectID)) {
                // Object doesn't exist in the current object anymore, remove it's fabric object.
                fabricObj.remove();
            } else {
                // Object still exists in current object, update it
                that.syncObject(currentObject.getChildByID(fabricObj.wickObjectID), fabricObj);
            }
        });

        // Add new objects and update zIndices
        currentObject.forEachActiveChildObject(function (child) {

            if(that.objectWithIDExistsInCanvas(child.id)) { 
                that.canvas.forEachObject(function(fabricObj) {
                    if(fabricObj.wickObjectID === child.id) {
                        var wickProjectIndex = currentObject.getCurrentFrame().wickObjects.indexOf(child);
                        that.canvas.moveTo(fabricObj, wickProjectIndex+3);
                    }
                });
            } else {
                that.createFabricObjectFromWickObject(child, function (newFabricObj) {
                    newFabricObj.wickObjectID = child.id;
                    canvas.add(newFabricObj);
                    var wickProjectIndex = currentObject.getCurrentFrame().wickObjects.indexOf(child);
                    that.canvas.moveTo(newFabricObj, wickProjectIndex+3);
                });
            }
        });

        // Reselect objects that were selected before sync
        if(selectedObjectIDs.length > 0) that.selectByIDs(selectedObjectIDs);

        this.canvas.renderAll();
    }

// White box that shows resolution/objects that will be on screen when project is exported

    this.frameInside = new fabric.Rect({
        fill: '#FFF',
    });

    this.frameInside.hasControls = false;
    this.frameInside.selectable = false;
    this.frameInside.evented = false;
    this.frameInside.identifier = "frameInside";

    this.canvas.add(this.frameInside)

// Crosshair that shows where (0,0) of the current object is

    fabric.Image.fromURL('resources/origin.png', function(obj) {
        that.originCrosshair = obj;

        that.originCrosshair.left = (window.innerWidth -wickEditor.project.resolution.x)/2- that.originCrosshair.width/2;
        that.originCrosshair.top  = (window.innerHeight-wickEditor.project.resolution.y)/2- that.originCrosshair.height/2;

        that.originCrosshair.hasControls = false;
        that.originCrosshair.selectable = false;
        that.originCrosshair.evented = false;
        that.originCrosshair.identifier = "originCrosshair";

        that.canvas.add(that.originCrosshair);
    });

// Text and fade that alerts the user to drop files into editor
// Shows up when a file is dragged over the editor

    // Fade
    this.dragToImportFileFade = new fabric.Rect({
        fill: '#000',
        opacity: 0
    });

    this.dragToImportFileFade.hasControls = false;
    this.dragToImportFileFade.selectable = false;
    this.dragToImportFileFade.evented = false;
    this.dragToImportFileFade.identifier = "dragToImportFileFade";

    this.canvas.add(this.dragToImportFileFade);

    // Text
    this.dragToImportFileText = new fabric.Text('Drop file to import', {
        fill: '#000',
        fontFamily: 'arial',
        opacity: 0
    });

    this.dragToImportFileText.hasControls = false;
    this.dragToImportFileText.selectable = false;
    this.dragToImportFileText.evented = false;
    this.dragToImportFileText.identifier = "dragToImportFileText";

    this.canvas.add(this.dragToImportFileText);

    var showDragToImportFileAlert = function() {
        that.canvas.bringToFront(this.dragToImportFileFade);
        that.canvas.bringToFront(this.dragToImportFileText);
        that.dragToImportFileFade.opacity = 0.3;
        that.dragToImportFileText.opacity = 1.0;
        that.canvas.renderAll();
    }
    var hideDragToImportFileAlert = function() {
        that.dragToImportFileFade.opacity = 0;
        that.dragToImportFileText.opacity = 0;
        that.canvas.renderAll();
    }
    $("#editorCanvasContainer").on('dragover', function(e) {
        showDragToImportFileAlert();
        return false;
    });
    $("#editorCanvasContainer").on('dragleave', function(e) {
        hideDragToImportFileAlert();
        return false;
    });
    $("#editorCanvasContainer").on('drop', function(e) {
        hideDragToImportFileAlert();
        return false;
    });

// Events

    var that = this;
    var canvas = this.canvas;

    // Listen for objects being changed so we can undo them in the action handler.
    canvas.on('object:modified', function(e) {

        // Delete text boxes with no text in 'em.
        if (e.target.text === '') {
            var wickObj = wickEditor.project.getChildByID(e.target.wickObjectID);
            // Make sure the original text comes back on undo
            wickObj.text = e.target.originalState.text;
            wickEditor.actionHandler.doAction('deleteObject', { ids:[e.target.wickObjectID] });
            return;
        }

        var frameOffset = that.getFrameOffset();

        var modifiedStates = [];
        var ids  = [];
        if(e.target.type === "group") {
            var group = e.target;
            for(var i = 0; i < group._objects.length; i++) {
                var obj = group._objects[i];
                ids[i] = obj.wickObjectID;
                modifiedStates[i] = {
                    x      : group.left + group.width /2 + obj.left - frameOffset.x,
                    y      : group.top  + group.height/2 + obj.top  - frameOffset.y,
                    scaleX : obj.scaleX,
                    scaleY : obj.scaleY,
                    angle  : obj.angle,
                    text   : obj.text
                };
            }
        } else {
            var obj = e.target;
            ids[0] = obj.wickObjectID;
            modifiedStates[0] = {
                x      : obj.left - frameOffset.x,
                y      : obj.top  - frameOffset.y,
                scaleX : obj.scaleX,
                scaleY : obj.scaleY,
                angle  : obj.angle,
                text   : obj.text
            };
        }

        wickEditor.actionHandler.doAction('modifyObjects', 
            {ids: ids,
             modifiedStates: modifiedStates}
        );
    });

    // Fabric doesn't select things with right clicks.
    // We have to do that manually
    canvas.on('mouse:down', function(e) {

        if(e.e.button == 2) {
            
            if (e.target && e.target.wickObjectID) {
                // Set active object of fabric canvas
                var id = canvas.getObjects().indexOf(e.target);
                canvas.setActiveObject(canvas.item(id)).renderAll();
            }

            if(!e.target) {
                // Didn't right click an object, deselect everything
                canvas.deactivateAll().renderAll();
                wickEditor.htmlInterface.closeScriptingGUI();
            }
            wickEditor.htmlInterface.syncWithEditorState();
            wickEditor.htmlInterface.openRightClickMenu();

        } else {
            wickEditor.htmlInterface.syncWithEditorState();
            wickEditor.htmlInterface.closeRightClickMenu();
        }
    });

    // Paths are handled internally by fabric so we have to 
    // intercept the paths and convert them to wickobjects

    var rasterizePath = function (pathFabricObject) {
        // Old straight-to-rasterized brush
        pathFabricObject.left -= that.getFrameOffset().x;
        pathFabricObject.top  -= that.getFrameOffset().y;
        
        WickObject.fromFabricPath(pathFabricObject, function(wickObj) {
            wickEditor.actionHandler.doAction('addObjects', {wickObjects:[wickObj]});
        });
    }

    var potracePath = function (pathFabricObject) {
        // New potrace-and-send-to-paper.js brush
        pathFabricObject.cloneAsImage(function(clone) {
            var imgSrc = clone._element.currentSrc || clone._element.src;

            Potrace.loadImageFromDataURL(imgSrc);
            Potrace.process(function(){
                var svg = Potrace.getSVG(1);
                wickEditor.paperInterface.addPathSVG(
                    svg, 
                    pathFabricObject.left, 
                    pathFabricObject.top, 
                    that.canvas.freeDrawingBrush.color);

            });
        }); 
    }

    canvas.on('object:added', function(e) {
        if(e.target.type !== "path") {
            return;
        }

        var path = e.target;
        //potracePath(path);
        rasterizePath(path);
        canvas.remove(e.target);

    });

    canvas.on('object:selected', function (e) {
        wickEditor.htmlInterface.reloadScriptingGUI();
        wickEditor.htmlInterface.updatePropertiesGUI();
    });

    canvas.on('selection:cleared', function (e) {
        wickEditor.htmlInterface.closeScriptingGUI();
        wickEditor.htmlInterface.updatePropertiesGUI('project');
    });

// GUI 

    this.resize = function () {
        this.updateCanvasResolution();
        this.repositionOriginCrosshair();
    }

    this.updateCanvasResolution = function () {

        var projectWidth = wickEditor.project.resolution.x;
        var projectHeight = wickEditor.project.resolution.y;

        var that = this;

        // Reposition all fabric objects to use new wick canvas origin and pan position

        var oldWidth = this.canvas.getWidth();
        var oldHeight = this.canvas.getHeight();

        this.canvas.setWidth ( window.innerWidth  );
        this.canvas.setHeight( window.innerHeight );
        this.canvas.calcOffset();

        var diffWidth = this.canvas.getWidth() - oldWidth;
        var diffHeight = this.canvas.getHeight() - oldHeight;

        this.canvas.forEachObject(function(fabricObj) {
            fabricObj.left += diffWidth /2;
            fabricObj.top  += diffHeight/2;
            fabricObj.setCoords();
        });

        // Re-center the import file alert text and fade

        this.dragToImportFileFade.width = window.innerWidth;
        this.dragToImportFileFade.height = window.innerWidth;
        this.dragToImportFileFade.left = 0;
        this.dragToImportFileFade.top  = 0;
        this.dragToImportFileFade.setCoords();

        this.dragToImportFileText.left = window.innerWidth /2-this.dragToImportFileText.width /2+this.canvasPanPosition.x;
        this.dragToImportFileText.top  = window.innerHeight/2-this.dragToImportFileText.height/2+this.canvasPanPosition.y;
        this.dragToImportFileText.setCoords();

        if(wickEditor.project.getCurrentObject().isRoot) {
            // In root object, frame box gets centered
            this.frameInside.width  = projectWidth;
            this.frameInside.height = projectHeight;
            this.frameInside.left = (window.innerWidth -projectWidth) /2 + this.canvasPanPosition.x;
            this.frameInside.top  = (window.innerHeight-projectHeight)/2 + this.canvasPanPosition.y;
            this.frameInside.setCoords();
        } else {
            // Not in root, frame box takes up whole screen
            this.frameInside.width  = window.innerWidth;
            this.frameInside.height = window.innerHeight;
            this.frameInside.left = 0;
            this.frameInside.top  = 0;
            this.frameInside.setCoords();
        }

        this.canvas.renderAll();

    }

    this.panTo = function (x,y) {

        var that = this;

        var oldPanPosition = {
            x:this.canvasPanPosition.x,
            y:this.canvasPanPosition.y
        }

        this.canvasPanPosition = {x:x,y:y};

        var canvasPanDiff = {
            x: this.canvasPanPosition.x - oldPanPosition.x,
            y: this.canvasPanPosition.y - oldPanPosition.y
        }

        this.canvas.forEachObject(function(fabricObj) {
            // Make sure to only move the frame if we're editing the root object
            // (While editing objects, the frame takes up the whole window.)
            if(fabricObj !== that.frameInside || wickEditor.project.getCurrentObject().isRoot) {
                fabricObj.left += canvasPanDiff.x;
                fabricObj.top  += canvasPanDiff.y;
                fabricObj.setCoords();
            }
        });

        this.canvas.renderAll();

    }

    this.repositionOriginCrosshair = function () {
        var projectWidth  = wickEditor.project.resolution.x;
        var projectHeight = wickEditor.project.resolution.y;
        var currentObjectLeft = wickEditor.project.getCurrentObject().left;
        var currentObjectTop  = wickEditor.project.getCurrentObject().top;

        // Move the origin crosshair to the current origin
        if(this.originCrosshair) { // window resize can happen before originCrosshair's image is loaded
            this.originCrosshair.left = (window.innerWidth -projectWidth) /2 - this.originCrosshair.width/2;
            this.originCrosshair.top  = (window.innerHeight-projectHeight)/2 - this.originCrosshair.height/2;
            
            this.originCrosshair.left += currentObjectLeft;
            this.originCrosshair.top += currentObjectTop;
            
            this.originCrosshair.left += this.canvasPanPosition.x;
            this.originCrosshair.top  += this.canvasPanPosition.y;

            this.canvas.renderAll();
        }
    }

// Interactivity utils

    this.selectByIDs = function (ids) {

        var objs = [];
        this.canvas.getObjects().map(function(o) {
            if(ids.indexOf(o.wickObjectID) != -1) {
                o.set('active', true);
                return objs.push(o);
            }
        });

        var group = new fabric.Group(objs, {
            originX: 'left', 
            originY: 'top'
        });

        this.canvas._activeObject = null;

        this.canvas.setActiveGroup(group.setCoords()).renderAll();

    }

    this.selectAll = function () {

        var objs = [];
        this.canvas.getObjects().map(function(o) {
            if(o.wickObjectID) {
                o.set('active', true);
                return objs.push(o);
            }
        });

        var group = new fabric.Group(objs, {
            originX: 'left', 
            originY: 'top'
        });

        this.canvas._activeObject = null;

        this.canvas.setActiveGroup(group.setCoords()).renderAll();

    }

    this.deselectAll = function () {

        var activeGroup = this.canvas.getActiveGroup();
        if(activeGroup) {
            activeGroup.removeWithUpdate(activeGroup);
            this.canvas.renderAll();
        }

        this.canvas.deactivateAll().renderAll();

    }

    this.clearCanvas = function () {

        var canvas = this.canvas;

        // Clear canvas except for wick GUI elements
        this.canvas.forEachObject(function(fabricObj) {
            if(fabricObj.wickObject) {
                canvas.remove(fabricObj);
            } 
        });

    }

    this.removeLastObject = function () {
        var canvas_objects = this.canvas._objects;
        if(canvas_objects.length !== 0){
            var last = canvas_objects[canvas_objects.length -1]; //Get last object   
            this.canvas.remove(last);
            this.canvas.renderAll();
        } 
    }

    this.getSelectedObjectIDs = function () {
        var ids = [];

        var obj   = this.canvas.getActiveObject();
        var group = this.canvas.getActiveGroup();

        if(obj) {
            ids.push(obj.wickObjectID);
        }

        if(group) {
            for(var i = 0; i < group._objects.length; i++) {
                ids.push(group._objects[i].wickObjectID);
            }
        }

        return ids;
    }
}
