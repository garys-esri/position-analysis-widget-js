function toggleDrawToolbar() {
    alert("now we did it!");
}

define([
    'dojo/_base/declare',
    'jimu/BaseWidget',
    "dijit/_WidgetsInTemplateMixin",
    "dijit/layout/AccordionContainer",
    "dijit/layout/ContentPane",
    "dijit/form/Select",
    "dijit/form/ToggleButton",
    "esri/toolbars/draw",
    "dojo/on",
    "esri/geometry/Point"],
function(declare, BaseWidget, _WidgetsInTemplateMixin, AccordionContainer, ContentPane, Select, ToggleButton, Draw, on, Point) {
    var clazz = declare([BaseWidget, _WidgetsInTemplateMixin], {
        baseClass: "jimu-widget-positionanalysis",
        
        drawToolbar: null,
        itemInfo: null,
        thisWidget: null,
        
        startup: function(){
            console.log("Welcome to the Position Analysis widget, using Dojo version " + dojo.version);
            this.inherited(arguments);
            
            thisWidget = this;
            
            drawToolbar = new Draw(this.map);
            dojo.connect(drawToolbar, "onDrawComplete", function (evt) {
                thisWidget.addPointLatLon(dijit.registry.byId("addShapesTargetLayer").value, evt.geographicGeometry.x, evt.geographicGeometry.y, false);
            });
            
            dijit.byId("btnClickPoints").watch("checked", function (propertyName, previousValue, newValue) {
                if (newValue) {
                    drawToolbar.activate(Draw.POINT);
                } else {
                    drawToolbar.deactivate();
                }
            });
        },
        
        onSignIn: function() {
            this.signInOutNode.innerHTML = "signed in";
        },
        
        onSignOut: function() {
            this.signInOutNode.innerHTML = "signed out";
        },
        
        loadMap: function (webMapId) {
            var settingsStatusElement = dojo.byId("settingsStatus");
            settingsStatusElement.innerHTML = "Loading Web map...";
            //Create the map, based on a Web map
            var mapDeferred = esri.arcgis.utils.createMap(webMapId, "map", {
                mapOptions: {
                    slider: true,
                    nav: false,
                    wrapAround180:true
                },
                ignorePopups:false
            });

            //When the map load completes or errors out, handle it
            mapDeferred.then(function (response) {
                //Just save the map control as a variable
                map = response.map;
                
                //Set up CSV drag and drop
                var mapNode = dojo.byId("map");
                dojo.connect(mapNode, "dragenter", function (evt) {
                    evt.preventDefault();
                });
                dojo.connect(mapNode, "dragover", function (evt) {
                    evt.preventDefault();
                });
                dojo.connect(mapNode, "drop", handleDrop);
                
                drawToolbar = new esri.toolbars.Draw(map);
                dojo.connect(drawToolbar, "onDrawComplete", function (evt) {
                    drawToolbar.deactivate();
                    addPointLatLon(dijit.registry.byId("addShapesTargetLayer").value, evt.geographicGeometry.x, evt.geographicGeometry.y, false);
                });
                
                var infoTemplateContentDiv = dojo.byId("infoTemplateContent");
                var innerHtml = infoTemplateContentDiv.innerHTML;
                
                itemInfo = response.itemInfo;
                if (itemInfo && itemInfo.itemData && itemInfo.itemData.operationalLayers) {
                    if (0 == itemInfo.itemData.operationalLayers.length) {
                        createOperationalLayer("Map Notes", function (newLayer) {
                            itemInfo.itemData.operationalLayers.push(newLayer);
                            setupLayerCheckboxes(itemInfo.itemData.operationalLayers);
                        });                
                    } else {
                        setupLayerCheckboxes(itemInfo.itemData.operationalLayers);
                    }
                } else {
                    settingsStatusElement.innerHTML = "Note: could not find Web map's operational layers. You might "
                            + "not be able to add features to the map.";
                }
            }, function(error){
                console.error('Create Map Failed: ' , dojo.toJson(error));
                //This might be a bad item ID or something else. Tell the user.
                settingsStatusElement.innerHTML = "Sorry, we found the Web map but couldn't load it.<br/><br/>"
                    + "Details: " + error;
            });
        }
        
        addPointLatLon: function (layerId, lon, lat, centerAtPoint, title, azimuth, distance) {
            var geom = new Point(lon, lat, new esri.SpatialReference({ wkid: 4326 }));
            return thisWidget.addShape(layerId, geom, centerAtPoint, title, azimuth, distance);
        },
        
        addShape: function (layerId, geom, centerAtShape, title, azimuth, distance) {
            var i;
            for (i = 0; i < itemInfo.itemData.operationalLayers.length; i++) {
                if (layerId == itemInfo.itemData.operationalLayers[i].id) {
                    var j;
                    for (j = 0; j < itemInfo.itemData.operationalLayers[i].featureCollection.layers.length; j++) {
                        var layerGeomType = itemInfo.itemData.operationalLayers[i].featureCollection.layers[j].featureSet.geometryType;
                        if (0 === layerGeomType.indexOf("esriGeometry")) {
                            layerGeomType = layerGeomType.substr("esriGeometry".length);
                        }
                        if (layerGeomType.toLowerCase() == geom.type) {
                            if (4326 == geom.spatialReference.wkid) {
                                geom = esri.geometry.geographicToWebMercator(geom);
                            }
                            var newFeature = {
                                geometry: geom.toJson(),
                                attributes: {
                                    VISIBLE: true,
                                    TITLE: title ? title : "New " + layerGeomType,
                                    TYPEID: 0,
                                    OBJECTID: getNextObjectId(itemInfo.itemData.operationalLayers[i].featureCollection.layers[j].featureSet),
                                    AZIMUTH: azimuth ? azimuth : undefined,
                                    DISTANCE: distance ? distance : undefined
                                }
                            };
                            itemInfo.itemData.operationalLayers[i].featureCollection.layers[j].featureSet.features.push(newFeature);
                            
                            var graphicsLayer = map.getLayer(itemInfo.itemData.operationalLayers[i].featureCollection.layers[j].id);
                            var graphic = new esri.Graphic(newFeature);
                            addGraphic(graphicsLayer, graphic);
                            
                            if (centerAtShape) {
                                if ("point" == geom.type) {
                                    map.centerAt(geom);
                                } else {
                                    //TODO center on non-point shape
                                }
                            }
                            
                            break;
                        }
                    }
                }
            }
        },
    });
    return clazz;
});