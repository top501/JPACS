
/*
 * Depends:
 * 1. jCanvasScript
 * 2. jQuery
 * 
 */
(function(window, undefined){
	
	//define enums
	var viewContext = {pan:1, select:2, create:3};
	var stepEnum = {step1:1, step2:2, step3:3, step4:4, step5:5};

	//define colors
	var colors = {white:'#ffffff', red:'#ff0000'};
	
	//define event type
	var eventType = {click:1, mouseDown:2, mouseMove:3, mouseUp:4, mouseOver:5, mouseOut:6, rightClick:7, dblClick:8};
	
	function screenToImage(x, y, imgTrans){
	
		var imgPt = [0,0,1];
		var scrennPt = [x, y, 1];
		
		var a = x, b = y, n1 = imgTrans[0][0], n2 = imgTrans[0][1], n3 = imgTrans[0][2];
		var n4 = imgTrans[1][0], n5 = imgTrans[1][1], n6 = imgTrans[1][2];
		
		var t = a*n4 - n3*n4 -b*n1 + n1*n6;
		var t2 = n2*n4 - n1*n5;
		
		imgPt[1] = t/t2;
		
		t = b*n2 - n2*n6 -a*n5+n3*n5;	
		imgPt[0] = t/t2;
			
		return {x: imgPt[0], y:imgPt[1]};
	}
	
	function imageToScreen(x, y, trans){
		
		var imgPt = [x, y, 1];
		var screenPt = [0, 0, 1];
	
		screenPt[0] = trans[0][0]*imgPt[0] + trans[0][1]*imgPt[1]+trans[0][2]*imgPt[2];
		screenPt[1] = trans[1][0]*imgPt[0] + trans[1][1]*imgPt[1]+trans[1][2]*imgPt[2];
	
		return {x: screenPt[0], y: screenPt[1]};
	}
	
	function countDistance(x1, y1, x2, y2){
		var value = Math.pow((x1-x2), 2) + Math.pow((y1-y2), 2);
		value = Math.sqrt(value);
		
		return Math.round(value * 100) / 100;
	}
	
	var globalViewerId = 1;
	function newViewerId(){
		globalViewerId++;
		return "viewer_" + globalViewerId;
	}
	
	/*********************************
	 * the dicomViewer class
	 */
	
	function dicomViewer(){
		this.id = newViewerId();
		this.annotationList = [];
		this.overlayList = [];
		this.dicomTagList = [];
		
		this.isReady = false;
		this.curContext = viewContext.pan;
		this.curSelectObj = undefined;
		
		this.imgLayerId = this.id +'_imgLayer';
		this.imgId = this.id +'_imgId';
		
		this.eventHandlers = {};
		this._objectIndex = 0;
	}
	
	dicomViewer.prototype._newObjectId = function(){
		this._objectIndex++;
		return this.id + "_obj_" + this._objectIndex;	
	}
	
	dicomViewer.prototype.initialize = function(canvasId, imgSrc, callBack){
		var dv = this;
		
		dv.canvas = document.getElementById(canvasId);
		dv.canvas.oncontextmenu = function(evt){dv.onContextMenu.call(dv, evt);};

		var dImg = new Image();
		dImg.onload = function(){
			jc.start(canvasId, true);
			
			dv.imgLayer = jc.layer(dv.imgLayerId).down('bottom');
			
			//register events
			dv.imgLayer.mousedown(function(arg){dv.onMouseDown.call(dv, arg)});	
			dv.imgLayer.mousemove(function(arg){dv.onMouseMove.call(dv, arg)});	
			dv.imgLayer.mouseup(function(arg){dv.onMouseUp.call(dv, arg)});	
			dv.imgLayer.click(function(arg){dv.onClick.call(dv, arg)});
			
			//show image
			jc.image(dv.dImg).id(dv.imgId).layer(dv.imgLayerId);
			
			dv.draggable(true);
			dv.isReady = true;
			
			if(callBack){
				callBack();
			}
		}
		
		dImg.src = imgSrc;
		this.dImg = dImg;
	}
	
	dicomViewer.prototype.setDicomTags = function(tagList){
		this.dicomTagList = tagList;	
	}
	
	dicomViewer.prototype.registerEvent = function(obj, type){
		if(!this.eventHandlers[type]){
			this.eventHandlers[type] = [];
		}
		
		var handlers = this.eventHandlers[type];
		var len = handlers.length, i;
		
		for(i = 0; i<len; i++ ){
			if(handlers[i] === obj){
				return;//exists already
			}	
		}
		
		handlers.push(obj);
	}
	
	dicomViewer.prototype.unRegisterEvent = function(obj, type){
		if(!this.eventHandlers[type]){
			return;
		}
		
		var handlers = this.eventHandlers[type];
		var len = handlers.length, i, found = false;
		
		for(i=0; i<len; i++){
			if(handlers[i] === obj){
				found = true;
				break;
			}
		}
		
		if(found){
			handlers.splice(i, 1);
		}
	}
	
	dicomViewer.prototype._handleEvent = function(arg, type, handler){
		var handlers = this.eventHandlers[type]
		if(!handlers || handlers.length == 0){
			return;
		}
		
		var ptImg = screenToImage(arg.x, arg.y, this.imgLayer.transform());
		handlers.forEach(function(obj){
			if(obj[handler]){
				obj[handler]({x:ptImg.x, y:ptImg.y});
			}
		});
	}
	
	dicomViewer.prototype.onClick = function(arg){
		this._handleEvent(arg, eventType.click, 'onClick');
	}
	
	dicomViewer.prototype.onMouseDown = function(arg){
		//if in select context, and not click any object, will unselect all objects.
		if(!arg.event.cancelBubble && this.curContext == viewContext.select){
			
			if(this.curSelectObj && this.curSelectObj.setEdit){
				this.curSelectObj.setEdit(false);
			}
		}
		
		this._handleEvent(arg, eventType.mouseDown, 'onMouseDown');
	}
	
	dicomViewer.prototype.onMouseMove = function(arg){
		this._handleEvent(arg, eventType.mouseMove, 'onMouseMove');
	}
	
	dicomViewer.prototype.onMouseUp = function(arg){
		this._handleEvent(arg, eventType.mouseUp, 'onMouseUp');
	}
		
	dicomViewer.prototype.onContextMenu = function(evt){
		
		if(this.curContext == viewContext.create){
			this.setContext(viewContext.select);
		}
		//todo: add context menus
		
		evt.stopImmediatePropagation();
		evt.stopPropagation();
		evt.preventDefault();
	}
	
	dicomViewer.prototype.draggable = function(draggable){
		
		var dv = this;
		var canvas = this.canvas;
		
		this.imgLayer.draggable({
			disabled: !draggable,
			drag: dv.onDragImage ? dv.onDragImage : function(arg){},
			start: function(arg){
				canvas.style.cursor = "move";
			},
			stop: function(arg){
				canvas.style.cursor = "default";
			}
		});
	}
	
	dicomViewer.prototype.setContext = function(ctx){
		var lastContext = this.curContext;
		
		if(lastContext !== ctx){
			var draggable = ctx == viewContext.pan;
			this.draggable(draggable);
			
			this.curContext = ctx;
			this.selectObject(undefined);
		}
	}
	
	dicomViewer.prototype.addOverlay = function(tag, pos){
		
	}
	
	dicomViewer.prototype.selectObject = function(obj){
		if(obj && obj instanceof annObject){
			
			this.curSelectObj = obj;
			
			//set all other obj not in edit status
			this.annotationList.forEach(function(otherObj){
				if(otherObj !== obj){
					otherObj.setEdit(false);
				}
				else{
					otherObj.setEdit(true);
				}
			});
		}
		else{
			if(this.curSelectObj){
				if(this.curSelectObj.isCreated){
					this.curSelectObj.setEdit(false);
				}
				else{
					this.curSelectObj.delete();
				}
			}
			
			this.curSelectObj = undefined;
		}
	}
	
	dicomViewer.prototype.deleteObject = function(obj){
		if(obj && obj instanceof annObject){
			obj.delete();
			
			if(this.annotationList.contains(obj)){
				this.annotationList.remove(obj);
			}
		}
	}
	
	dicomViewer.prototype.createRect = function(){
		var aRect = new annRect(this);
		this.setContext(viewContext.create);
		
		this.curSelectObj = aRect;
		aRect.startCreate();
		
		return aRect;
	}
	
	dicomViewer.prototype.createLine = function(){
		var aLine = new annLine(this);
		this.setContext(viewContext.create);
		
		this.curSelectObj = aLine;
		aLine.startCreate();
		
		return aLine;
	}
	
	dicomViewer.prototype.onObjectCreated = function(obj){
		if(obj && obj.isCreated){
			//finish create
			this.curSelectObj = obj;
			this.curContext = viewContext.select;
			this.annotationList.push(this.curSelectObj);
			this.curSelectObj.setEdit(true);
		}
	}
	
	/*********************************
	 * the dicomTag definition
	 */
	
	function dicomTag(group, element, value){
		this.group = group;
		this.element = element;
		this.value = value;
	}
	
		
	/*********************************
	 * the overlay definition
	 */
	function overlay(tag, pos){
		this.tag = tag;
		this.position = pos;
	}
	
	
	/*********************************
	 * the annObject class
	 */

	function annObject(){
		this.parent = undefined;
		this.isInEdit = false;
		this.isCreated = false;
	}
	
	//set child jcObject's common mouse event hander, etc.
	annObject.prototype._setChildMouseEvent = function(jcObj, overStyle){
		var dv = this.parent;
		var annObj = this;
		
		if(!overStyle){
			overStyle='pointer';
		}
		
		jcObj.mouseover(function(arg){
			if(dv.curContext == viewContext.select)
				dv.canvas.style.cursor = overStyle;
		});
		
		jcObj.mouseout(function(){
			if(dv.curContext == viewContext.select)
				dv.canvas.style.cursor = 'default';
		});
		
		jcObj.mousedown(function(arg){
			if(dv.curContext == viewContext.select){
				dv.selectObject(annObj);
				
				arg.event.cancelBubble = true;
			}
		});		
	}
	
	annObject.prototype._setChildDraggable = function(jcObj, draggable, onDrag){
		var dv = this.parent;
		var annObj = this;
		var transTmp = dv.imgLayer.transform();
		
		jcObj.draggable({
			disabled: !draggable,
			start: function(arg){
				this._lastPos = {};
			},
			stop: function(arg){
				this._lastPos = {};
			},
			drag: function(arg){
				var ptImg = screenToImage(arg.x, arg.y, transTmp);
				
				if (typeof(this._lastPos.x) != 'undefined') {
	
					var deltaX = ptImg.x - this._lastPos.x;
					var deltaY = ptImg.y - this._lastPos.y;
					
					this.translate(deltaX, deltaY);
					
					if(onDrag){
						onDrag.call(annObj, deltaX, deltaY);
					}
				}
				
				this._lastPos = {
					x: ptImg.x,
					y: ptImg.y
				};
				
				return true;
			}
		});
	}
	
	/*********************************
	 * the annRect class
	 */
	
	function annRect(viewer){
		annObject.call(this);
		this.parent = viewer;
		this.id = viewer._newObjectId();
	}
	
	annRect.prototype = new annObject();
	
	annRect.prototype.onMouseDown = function(arg){
		if(this.curStep == stepEnum.step1){
			this.ptStart = {x: arg.x, y:arg.y};
			this.curStep = stepEnum.step2;
		}
	}
	
	annRect.prototype.onMouseMove = function(arg){
		var dv = this.parent;
		if(this.curStep == stepEnum.step2){
			this.width = Math.abs(arg.x - this.ptStart.x);
			this.height = Math.abs(arg.y - this.ptStart.y);
			
			//create rect if not created
			if(!this.rect){
				var rectId = dv._newObjectId();
				jc.rect(this.ptStart.x, this.ptStart.y, this.width, this.height).layer(dv.imgLayerId).id(rectId).color(colors.white);
				this.rect = jc('#'+ rectId);
				
				this._setChildMouseEvent(this.rect);
			}
			
			this.rect._width = this.width;
			this.rect._height = this.height;
			
			if(!this.circleA){
				var idCircleA = this.id+"_aCircle";
				jc.circle(this.ptStart.x, this.ptStart.y, 5).id(idCircleA).layer(dv.imgLayerId).color(colors.white);
				this.circleA = jc("#"+idCircleA);
				
				this._setChildMouseEvent(this.circleA, 'crosshair');
			}
		
			if(!this.label){
				var idLbl = this.id+"_lbl";
				var lblPos = {x:this.ptStart.x+5, y:this.ptStart.y-5};
				jc.text('', lblPos.x, lblPos.y).id(idLbl).layer(dv.imgLayerId).color(colors.white).font('15px Times New Roman');
				this.label = jc('#'+idLbl);
				
				this._setChildMouseEvent(this.label);
			}
			
			this.updateLabel();
		}
	}
	
	annRect.prototype.onMouseUp = function(arg){
		var dv = this.parent;
		if(this.curStep == stepEnum.step2){
			this.isCreated = true;
			dv.onObjectCreated(this);
			
			dv.unRegisterEvent(this, eventType.mouseDown);
			dv.unRegisterEvent(this, eventType.mouseMove);
			dv.unRegisterEvent(this, eventType.mouseUp);
		}
		else{
			this.curStep = stepEnum.step1;
		}
	}

	annRect.prototype.startCreate = function(){
		this.curStep = stepEnum.step1;
		var dv = this.parent;
		
		dv.registerEvent(this, eventType.mouseDown);
		dv.registerEvent(this, eventType.mouseMove);
		dv.registerEvent(this, eventType.mouseUp);
	}
	
	annRect.prototype.delete = function(){
		var dv = this.parent;
		if(!this.isCreated){
			//unregister events
			dv.unRegisterEvent(this, eventType.mouseDown);
			dv.unRegisterEvent(this, eventType.mouseMove);
			dv.unRegisterEvent(this, eventType.mouseUp);
		}
	}
	
	annRect.prototype.setEdit = function(edit){
		this.isInEdit = edit;
		this.setDraggable(edit);
		this.circleA.visible(edit);
		
		if(edit){
			this.rect.color(colors.red);
			this.label.color(colors.red);
			this.circleA.color(colors.red);
		}
		else{
			this.rect.color(colors.white);
			this.label.color(colors.white);
			this.circleA.color(colors.white);
		}
	}
	
	annRect.prototype.updateLabel = function(){
		var size = 2*(this.width + this.height);
		var msg = "size=" + size;
		
		this.label.string(msg);
	}
	
	annRect.prototype.setDraggable = function(draggable){
		var aRect = this;
		var transTmp = this.parent.imgLayer.transform();
		
		this._setChildDraggable(this.rect, draggable, function(deltaX, deltaY){
			aRect.circleA.translate(deltaX, deltaY);
			aRect.label.translate(deltaX, deltaY);
		});
		
		this._setChildDraggable(this.circleA, draggable, function(deltaX, deltaY){
			aRect.rect.translate(deltaX, deltaY);
			aRect.rect._width -= deltaX;
			aRect.rect._height -= deltaY;
			aRect.width = aRect.rect._width;
			aRect.height = aRect.rect._height;
			aRect.label.translate(deltaX, deltaY);	
			aRect.updateLabel();
		});
		
		this._setChildDraggable(this.label, draggable);
	}
	
	/*********************************
	 * the annLine class
	 */
	
	function annLine(viewer){
		annObject.call(this);
		this.parent = viewer;
		this.id = viewer._newObjectId();
	}
	
	annLine.prototype = new annObject();
	
	annLine.prototype.startCreate = function(){
		var dv = this.parent;
		this.curStep = stepEnum.step1;
		
		dv.registerEvent(this, eventType.click);
	}
	
	annLine.prototype.onClick = function(arg){
		var dv = this.parent;
		
		if(this.isCreated){
			return;
		}
		
		if(this.curStep == stepEnum.step1){
			this.ptStart = {x: arg.x, y: arg.y};
			
			var idCircleStart = this.id +'_c1';
			jc.circle(this.ptStart.x, this.ptStart.y, 5).id(idCircleStart).layer(dv.imgLayerId).color(colors.white);
			this.circleStart = jc('#'+idCircleStart);
			
			this.curStep = stepEnum.step2;
		}
		else if(this.curStep == stepEnum.step2){
			this.ptEnd = {x: arg.x, y:arg.y};
				
			var idCircleEnd = this.id +'_c2';
			jc.circle(this.ptEnd.x, this.ptEnd.y, 5).id(idCircleEnd).layer(dv.imgLayerId).color(colors.white);
			this.circleEnd = jc('#'+idCircleEnd);
			
			var lineId = this.id +'_line';
			jc.line([[this.ptStart.x, this.ptStart.y],[this.ptEnd.x, this.ptEnd.y]]).id(lineId).layer(dv.imgLayerId).color(colors.white);
			this.line = jc('#'+lineId);
			
			var idCircleM = this.id+'_cm';
			var ptMiddle = {};
			ptMiddle.x = (this.ptStart.x + this.ptEnd.x) / 2;
			ptMiddle.y = (this.ptStart.y + this.ptEnd.y) / 2;	
			jc.circle(ptMiddle.x, ptMiddle.y, 5).id(idCircleM).layer(dv.imgLayerId).color(colors.white);
			this.circleMiddle = jc('#'+idCircleM);
			
			var idLbl = this.id+'_lbl';
			var lblPos = {x:this.ptStart.x +5, y:this.ptStart.y-5};
			jc.text('', lblPos.x, lblPos.y).id(idLbl).layer(dv.imgLayerId).color(colors.white).font('15px Times New Roman');
			this.label = jc('#'+idLbl);
			
			var idLblLine = this.id+'_lblLine';
			var ptLblCenter = this.label.getCenter();
			ptLblCenter = screenToImage(ptLblCenter.x, ptLblCenter.y, dv.imgLayer.transform());
			ptLblCenter.y+= 15;
			jc.line([[ptLblCenter.x, ptLblCenter.y],[ptMiddle.x, ptMiddle.y-5]]).id(idLblLine).layer(dv.imgLayerId).color(colors.white);
			this.lableLine = jc('#'+idLblLine);
			
			this._reDraw();
			
			this._setChildMouseEvent(this.circleStart, 'crosshair');
			this._setChildMouseEvent(this.circleEnd, 'crosshair');
			this._setChildMouseEvent(this.circleMiddle, 'crosshair');
			this._setChildMouseEvent(this.label);
			
			this.isCreated = true;
			dv.onObjectCreated(this);
			
			//unregister events
			dv.unRegisterEvent(this, eventType.click);
		}
		
		return;
	}
	
	annLine.prototype.delete = function(){
		var dv = this.parent;
		if(!this.isCreated){
			//unregister events
			dv.unRegisterEvent(this, eventType.click);
		}
		
		if(this.circleStart){
			this.circleStart.del();
			this.circleStart = undefined;
		}
		if(this.circleEnd){
			this.circleEnd.del();
			this.circleEnd = undefined;
		}
		if(this.circleMiddle){
			this.circleMiddle.del();
			this.circleMiddle = undefined;
		}
		if(this.label){
			this.label.del();
			this.label = undefined;
		}
		if(this.lableLine){
			this.lableLine.del();
			this.lableLine = undefined;
		}
		
		this.isCreated = false;
	}
	
	annLine.prototype.setEdit = function(edit){
		this.isInEdit = edit;
		this.setDraggable(edit);
		
		if(edit){
			this.line.color(colors.red);
			this.label.color(colors.red);
			this.lableLine.color(colors.red);
			this.circleStart.color(colors.red).opacity(1);
			this.circleEnd.color(colors.red).opacity(1);
			this.circleMiddle.color(colors.red).opacity(1);	
		}
		else{
			this.line.color(colors.white);
			this.label.color(colors.white);
			this.lableLine.color(colors.white);
			this.circleStart.color(colors.white).opacity(0);
			this.circleEnd.color(colors.white).opacity(0);
			this.circleMiddle.color(colors.white).opacity(0);
		}
	}
	
	annLine.prototype.setDraggable = function(draggable){
		var aLine = this;
		var transTmp = this.parent.imgLayer.transform();
		
		var cs = aLine.circleStart;
		var ce = aLine.circleEnd;
		var cm = aLine.circleMiddle;
		var lbl = aLine.label;
		
		this._setChildDraggable(cs, draggable, function(deltaX, deltaY){
			aLine.ptStart = {x: cs._x+cs._transformdx, y:cs._y+cs._transformdy};
					
			aLine._reDraw();		
		});
		
		this._setChildDraggable(ce, draggable, function(deltaX, deltaY){
			aLine.ptEnd = {x: ce._x+ce._transformdx, y:ce._y+ce._transformdy};
					
			aLine._reDraw();
		});
		
		this._setChildDraggable(cm, draggable, function(deltaX, deltaY){
			cm.translate(-deltaX, -deltaY);
			
			cs.translate(deltaX, deltaY);
			ce.translate(deltaX, deltaY);
			
			aLine.ptStart = {x: cs._x+cs._transformdx, y:cs._y+cs._transformdy};
			aLine.ptEnd = {x: ce._x+ce._transformdx, y:ce._y+ce._transformdy};
			
			aLine._reDraw();
		});
		
		this._setChildDraggable(lbl, draggable, function(deltaX, deltaY){
			aLine._reDraw();
		});
	}
	
	annLine.prototype._reDraw = function(){
		var dv = this.parent;
		this.line.points([[this.ptStart.x, this.ptStart.y],[this.ptEnd.x, this.ptEnd.y]]);
		
		var ptMiddle = {};
		ptMiddle.x = (this.ptStart.x + this.ptEnd.x) / 2;
		ptMiddle.y = (this.ptStart.y + this.ptEnd.y) / 2;	
		this.circleMiddle._x = ptMiddle.x;
		this.circleMiddle._y = ptMiddle.y;
		this.circleMiddle._transformdx = 0;
		this.circleMiddle._transformdy = 0;
		
		var ptLblCenter = this.label.getCenter();
		ptLblCenter = screenToImage(ptLblCenter.x, ptLblCenter.y, dv.imgLayer.transform());
		ptLblCenter.y+= 15;
		this.lableLine.points([[ptLblCenter.x, ptLblCenter.y],[ptMiddle.x, ptMiddle.y - 5]]);
		
		var msg = "length: " + countDistance(this.ptStart.x, this.ptStart.y, this.ptEnd.x, this.ptEnd.y);
		this.label.string(msg);
	}
	
	//export definitiens
	window.dicomViewer = dicomViewer;
	window.dicomTag = dicomTag;
	window.overlay = overlay;
	window.viewContext = viewContext;
	
})(window, undefined);