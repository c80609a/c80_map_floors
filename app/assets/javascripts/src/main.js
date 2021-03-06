"use strict";

var IS_ADMIN = false;
var map_on_index_page = null;

var InitMap = function (params) {

    var dnd_enable = true;
    //noinspection EqualityComparisonWithCoercionJS
    if (params != undefined && params['dnd_enable'] != undefined) {
        dnd_enable = params['dnd_enable'];
    }

    // - to delete start -----------------------------------------------------------------------------------------------------------------------
    var scale = 0.599999;

    var image_width = MAP_WIDTH * scale;
    var image_height = MAP_HEIGHT * scale;

    var x = image_width/2;
    var y = image_height/2;
    // - to delete end -----------------------------------------------------------------------------------------------------------------------

    var map_params = {
        source:LOCS_HASH,
        scale: scale,
        x: x,
        y: y,
        mapwidth: MAP_WIDTH,
        mapheight: MAP_HEIGHT
    };
    map_params = $.extend(map_params, params);
    map_on_index_page = $('#map_wrapper').beMap(map_params);

};

(function () {

    var Map = function () {
        var self = this;

        self.o = {
            source: 'locations.json', // data
            height: 400,    // viewbox height, pixels
            mapwidth: 100,   // actual image size, in pixels
            mapheight: 100,
            mapfill: true,
            zoom: true,
            zoombuttons: true,
            maxscale: 3,
            fitscale: 0.51,
            skin: '',         // css class name
            scale: 1,
            x: 0,
            y: 0,
            dnd_enable: true,
            debug: false,

            // координаты области (в системе координат контейнера, который содержит карту),
            // в которую вписывается картинка этажа при входе в него
            left_padding: 20,
            focus_area_width: 520,
            top_padding: 20,
            focus_area_height: 520,

            // прямоугольник, который расположен на изображении, в котором находится осмысленное
            // содержимое карты. Значения в системе координат изображения, получены с помощью photoshop.
            // TODO:: эти значения должны высчитываться при геренации json при наличии полигонов зданий
            bounding_box: {
                x: 0,
                y: 0,
                width: 0,
                height: 0
            }
        };
        self.svg = null;
        self.svg_overlay = null;
        self.container = null;
        self.mode = 'viewing';
        self.prev_mode = null;
        self.setMode = null;
        self.selected_area = null;      // ссылка на полигон из #svg_overlay
        self.drawing_poligon = null;
        self.events = [];
        self.edit_type = null;
        self.remove_button_klass = null;
        self.new_button_klass = null;
        self.edit_button_klass = null;
        self.complete_creating_button_klass = null;
        self.back_to_map_button_klass = null;
        self.current_building = null;
        self.current_area = null;
        self.is_draw = false;
        self.save_button_klass = null;
        self.area_link_button_klass = null;
        self.building_link_button_klass = null;
        self.floor_link_button_klass = null;
        self.update_json_klass = null;
        self.drawn_areas = []; // если имеются нарисованные но несохранённые Площади - они хранятся тут
        self.drawn_buildings = []; // если имеются нарисованные но несохранённые Здания - они хранятся тут
        self.areas_for_delete = []; // если имеются Площади, которые готовы к удалению, они хранятся тут
        self.save_preloader_klass = null;
        self.last_clicked_g = null; // начали просматривать area\building (запустили сессию), и здесь храним ссылку на последний кликнутый полигон из svg_overlay в течение сессии
        //self.o.dnd_enable = null; // если да, то можно карту dnd мышкой
        self.building_info_klass = null; // класс, занимающися отображением данных об этаже\здании\площади
        self.search_gui_klass = null; // класс, занимающийся обслуживанием поисковых запросов пользователя карты

        // во время анимации каждый шаг рассчитывается мгновенный scale
        self.scale_during_animation = null;

        // true, если:
        //- юзер еще не кликал по кнопкам zoom
        //- юзер еще не делал drag-n-drop
        //- юзер ещё не вошёл ни в здание ни в площадь
        // Т.Е., другими словами, true до момента, пока пользователь не начал взаимодействовать с картой
        self.mark_virgin = true;

        // здесь сохранятся параметры для метода moveTo
        // чтобы вернуть карту в исходное состояние после нажатия кнопки "назад на карту"
        self.initial_map_position = null;

        // грузит и отображает картинки заранее известного размера (WxH px), показывает прелоадер
        self._imageLoader = null;

        self.init = function (el, params) {

            console.log('[Map.init]');

            // extend options
            self.o = $.extend(self.o, params);
            self.o.height = _$m.outerHeight();

            self.x = self.o.x;
            self.y = self.o.y;
            self.scale = self.o.scale; /* NOTE:: инициализация: начальные значения */

            self.el = el.addClass('melem mloading').addClass(self.o.skin).height(self.o.height);

            // Disable modules when landmark mode is active
            /*if (self.o.landmark) {
             self.o.sidebar = false;
             self.o.zoombuttons = false;
             self.o.deeplinking = false;
             }*/

            // инициализиуем класс, занимающийся отображением данных о здании\этаже\площади
            self.building_info_klass = new BuildingInfo({
                onFloorTabChange: function (floor_id) {
                    self.current_building.enterFloor(floor_id); //#-> только с помощью клика по табам можно войти на Этаж
                    self.back_to_map_button_klass.show(10);
                }
            });

            if (typeof self.o.source === 'string') {
                // Loading .json file with AJAX
                $.getJSON(self.o.source, function (data) { // Success
                    initProcessData(data);
                    self.el.removeClass('mloading');
                    //setTimeout(invalidateZoom,1000);

                }).fail(function () { // Failure: couldn't load JSON file, or it is invalid.
                    console.error('Couldn\'t load map data. (Make sure you are running the script through a server and not just opening the html file with your browser)');
                    self.el.removeClass('mloading').addClass('merror');
                    alert('Data file missing or invalid!');
                });
            }
            else {
                // Inline json object
                initProcessData(self.o.source);
                self.el.removeClass('mloading');
            }


            return self;


        };

        var initProcessData = function (data) {

            self.data = data;

            self.container = $('.mcontainer'); //$('<div></div>').addClass('mcontainer').appendTo(self.el);
            self.map = self.container.find('.mmap'); //$('<div></div>').addClass('mmap').appendTo(self.container);
            if (self.o.zoom) self.map.addClass('mapplic-zoomable');
            self.map_layers = self.map.find('.layers');
            self.map_overlay_layers = self.map.find('.overlay_layers');

            self.svg = $("#svg");
            self.svg_overlay = $('#svg_overlay');
            //$('<svg></svg>')
            //.attr('xmlns','http://www.w3.org/2000/svg')
            //.attr('version','1.2')
            //.attr('baseProfile','tiny')
            //.attr('id','svg')
            //.appendTo(self.map);

            self.levelselect = $('<select></select>').addClass('mlevels_select');

            self.container.css('width', '100%'); // if (!self.o.sidebar)

            self.contentWidth = parseInt(data.mapwidth);
            self.contentHeight = parseInt(data.mapheight);

            self.hw_ratio = data.mapheight / data.mapwidth;

            self.map.css({
                'width': data.mapwidth,
                'height': data.mapheight
            });

            /*  NOTE:: важная строка: определяет css и js поведение кое-где [qwwqq]:
                2016-10-19

                1. Всё начинается в JSON - в самом начале разработки проектировался JSON:
                2. там для root объекта указан был
                руками
                набор характеристик. Среди которых был и object_type[переименован в class_name].
                3. на тот момент object_type был равен строке "main_map".
                4. Затем эта строка (в процессе разработки) стала использоваться, как
                имя css класса, и были накиданы стили для оформления.
                5. Затем, уже css класс был использован внутри StateController.js, который
                работает с состоянием приложения и видимостью детей '.main_map'.

                По хорошему - надо убрать из JSON этот параметр,
                а здесь рукми напишем строку 'main_map', что и сделаем.
            */
            // Create new map layer
            var layer = $('<div></div>')
                .addClass('mlayer')
                //.addClass(data["class_name"])/* [qwwqq] */
                .addClass("main_map")/* [qwwqq] */
                .appendTo(self.map_layers); // .hide()
            $('<img src="">').attr('src', data["img"]).addClass('mmap-image').appendTo(layer);

            // Zoom buttons
            if (self.o.zoombuttons) {
                self.zoombuttons = new ZoomButtons();
                self.zoombuttons.init({height: self.o.height}, self);
                //if (!self.o.clearbutton) self.zoombuttons.el.css('bottom', '0');
            }

            var sc = new StateController();
            sc.init(self);
            self.setMode = sc.setMode;

            self._imageLoader = new ImageLoader();

            // Admin buttons
            $.ajax({
                url: '/ajax/map_edit_buttons',
                type: 'POST',
                dataType: 'script',
                data: {
                    div_css_selector: '#container_buttons .mzoom_buttons'
                }
            }).done(function () {
                console.log('[ajax.done]');

                self.update_json_klass = new UpdateJsonButton();
                self.update_json_klass.init('.mapplic-update-json', self);

                self.edit_button_klass = new EditButton();
                self.edit_button_klass.init('.mapplic-edit-button', self);

                var e = new NewButton();
                e.init('.mapplic-new-button', self);
                self.new_button_klass = e;

                e = new RemoveButton();
                e.init('.mapplic-remove-button', self);
                self.remove_button_klass = e;

                e = new CancelRemoveButton();
                e.init('#cancelRemoving', self);

                e = new CancelCreatingButton();
                e.init("#cancelCreating", self);

                e = new CompleteCreatingButton();
                e.init("#completeCreating", self);

                self.save_button_klass = new SaveChangesButton();
                self.save_button_klass.init('.mapplic-save-button', self);

                // при клике на эту кнопку произойдет показ модального окна
                self.area_link_button_klass = new AreaLinkButton();
                self.area_link_button_klass.init('.mapplic-area-link-button', self);

                // при клике на эту кнопку произойдет показ модального окна "связать полигон этажа с Этажом"
                self.floor_link_button_klass = new FloorLinkButton();
                self.floor_link_button_klass.init('.mapplic-floor-link-button', self);

                // при клике на эту кнопку произойдет показ модального окна, в котором можно будет указать здание, соответствующее полигону
                self.building_link_button_klass = new BuildingLinkButton();
                self.building_link_button_klass.init('.mapplic-building-link-button', self);

                $('[data-toggle="tooltip"]').tooltip();

            });

            // драг энд дроп и прочая мышь
            initAddControls();

            // NOTE:: запускаем данные в карту
            self.draw_childs(data["buildings"]);

            // инициализируем класс, обслуживающий поиск
            self.search_gui_klass = new SearchGUI(self);

            self.calcViewArea();            
            self.invalidateViewArea();

        };

        // позиционируем картинку и gui елементы
        self.invalidateViewArea = function () {

            //<editor-fold desc="// вписываем картинку карты в "главный" прямоугольник карты (т.е. рассчитываем масштаб)">
                var scaleX = self.calcScale(
                    self.o['bounding_box']['x'],
                    self.o['bounding_box']['x'] + self.o['bounding_box']['width'],
                    self.X10, self.X20);

                // note:: вписываем по ширине
                // var scaleY = self.calcScale(
                //     self.o['bounding_box']['y'],
                //     self.o['bounding_box']['y'] + self.o['bounding_box']['height'],
                //     self.Y10,
                //     self.Y20);
                // var scale = (scaleX < scaleY) ? scaleX : scaleY;
                // self.scale = scale;

                self.scale = scaleX;
            //</editor-fold>

            // совмещаем точку на экране, в которую надо центрировать карту,
            // с центром карты,
            // с учётом рассчитанного масштаба

            // центр в системе координат контейнера который совмещаем с центром картинки.
            var screen_center_x, screen_center_y;

            // центр картинки (координаты в системе координат картинки)
            var cx, cy;

            screen_center_x = self.CX0;
            screen_center_y = self.CY0;
            cx = self.o['bounding_box']['x'] + self.o['bounding_box']['width']/2;
            cy = self.o['bounding_box']['y'] + self.o['bounding_box']['height']/2;

            self.x = self.normalizeX({
                x: screen_center_x - self.scale * cx,
                scale: self.scale
            });
            self.y = self.normalizeY({
                y: screen_center_y - self.scale * cy,
                scale: self.scale
            });
            self.moveTo(self.x, self.y, self.scale, 100);

            // будет использован при клике по кнопке "обратно на карту"
            self.initial_map_position = {
                x: self.x,
                y: self.y,
                scale: self.scale
            };

            // позиционируем элементы
            self.building_info_klass.set_left(self.X2);
            $area_order_button.css("left", self.X2 + "px");
            if (self.container) $container_buttons.css("margin-top", (self.container.height() -10) + "px");

        };
        
        // драг энд дроп и прочая мышь
        var initAddControls = function () {
            var map = self.map,
                mapbody = $('.mmap-image', self.map);

            document.ondragstart = function () {
                return false;
            }; // IE drag fix

            /* после запуска приложения - всегда слушаем нажатия мышью на полигоны и вершины */
            function onSvgMousedown(e) {

                //#-> Убрал 'edit_building', т.к. мы не можем ничего нарисовать в этом режиме - картинки этажей добавляются через админку
                if (self.mode === 'editing' || self.mode === 'edit_area' || self.mode === 'edit_floor') { // || self.mode === "edit_building"
                    if (e.target.parentNode.tagName === 'g') {
                        console.log("[onSvgMousedown] Нажали мышью на полигон или вершину.");
                        //console.log(e.pageX);
                        //console.log("[mouseDown] e.target.parentNode.tagName = " + e.target.parentNode.tagName);
                        //console.log(e.target);
                        //info.unload();

                        // если ДО этого нажатия уже была "выбранная" область - "снимем" с неё css класс
                        //noinspection EqualityComparisonWithCoercionJS
                        if (self.selected_area != null) {
                            self.selected_area.deselect();
                        }

                        // запомним ссылку на "выбранную" область
                        self.selected_area = e.target.parentNode.obj;

                        //app.deselectAll();

                        // поменяем внешний вид полигона - добавим класс .selected
                        self.selected_area.select();

                        // запомним начальные координаты кликаы
                        self.selected_area.delta = {
                            'x': e.pageX,
                            'y': e.pageY
                        };

                        //#-> a) Определяем, что хотим подвинуть мышкой методом drag-n-drop

                        // если хотим подвинуть вершину
                        if (utils.hasClass(e.target, 'helper')) {
                            var helper = e.target;
                            self.edit_type = helper.action; // pointMove

                            if (helper.n >= 0) { // if typeof selected_area == polygon
                                self.selected_area.selected_point = helper.n;
                            }

                            //#-> b) После этого вешаем слушатели
                            self.addEvent(self.el[0], 'mousemove', self.onMouseMove)
                                .addEvent(self.el[0], 'mouseup', self.onMouseUp);

                        }
                        // если хотим подвинуть фигуру
                        //#-> отменили dnd фигур 20161227
                        else if (e.target.tagName === 'rect' || e.target.tagName === 'circle' || e.target.tagName === 'polygon') {
                            //self.edit_type = 'move';

                            // если это полигон здания - фиксируем его
                            //noinspection EqualityComparisonWithCoercionJS
                            if (self.selected_area != null) {
                                var selected_area_building = self.selected_area.building;
                                //noinspection EqualityComparisonWithCoercionJS
                                if (selected_area_building != null) {
                                    self.current_building = selected_area_building; // фиксируем полигон здания в режиме "редактирования карты" при клике по полигону на карте
                                    console.log("[self.onSvgMousedown] Это не Drag-n-drop, а обычный клик по полигону Здания c id=" + self.current_building.options["id"]);

                                    // включим кнопку "связать Здание"
                                    self.building_link_button_klass.en_check();

                                } else {
                                    console.log("[self.onSvgMousedown] Это не Drag-n-drop, а обычный клик по фигуре.");
                                }
                            }

                        }

                        // когда реализуем корректный механизм dnd фигур, тут должен очутиться (b)

                    } else {
                        //app.deselectAll();
                        //info.unload();
                    }
                }
            }

            self.svg.on('mousedown', onSvgMousedown);
            //self.el[0].addEventListener('mousedown', onSvgMousedown, false);


            // Drag & drop
            function onDragNdrop(event) {
                //console.log("[mousedown] edit_type = " + self.edit_type);
                console.log("[mousedown] mode = " + self.mode + ", dnd_enable = " + self.o.dnd_enable + ', edit_type = ' + self.edit_type);
                //console.log(event);

                // если в данный момент не редактируем фигуру (т.е. не двигаем вершину фигуры)
                //noinspection EqualityComparisonWithCoercionJS
                if (self.edit_type == null) {
                    self.dragging = false;
                    map.stop();

                    map.data('mouseX', event.pageX - self.x);
                    map.data('mouseY', event.pageY - self.y);
                    map.data('lastX', self.x);
                    map.data('lastY', self.y);
                    map.data('startX', self.x);
                    map.data('startY', self.y);

                    map.addClass('mdragging');

                    self.map.on('mousemove', function (event) {
                        self.dragging = true;

                        if (self.o.dnd_enable) { // NOTE:: добавить возможность делать dnd находясь в режиме рисования (админа?)
                            var x = event.pageX - map.data('mouseX');// + self.x;
                            var y = event.pageY - map.data('mouseY');// + self.y;

                            x = self.normalizeX({
                                x:x,
                                scale: self.scale
                            });
                            y = self.normalizeY({
                                y:y,
                                scale: self.scale
                            });

                            //console.log("[Map.mousemove] x = " + x + "; y = " + y);
                            //console.log("[Map.mousemove] Call moveTo.");
                            self.moveTo(x, y); /* NOTE:: вызывается во время dnd */
                            map.data('lastX', x);
                            map.data('lastY', y);
                        }
                    });

                    //noinspection JSUnresolvedFunction
                    $(document).on('mouseup', function (event) {
                        //console.log("[mouseup] dragging = " + self.dragging + ", mode = " + self.mode + "; is_draw = " + self.is_draw + "; scale = " + self.scale);
                        //console.log("[mouseup] event = ");
                        //console.log(event);
                        //console.log("[mouseup] event.target = ");
                        //console.log($(event.target).parent()[0].obj);

                        //console.log("[mouseup] [qq] screen: " + event.pageX + ", " + event.pageY +
                        //"; logic: " + self.rightX(event.pageX) + ", " + self.rightY(event.pageY));

                        console.log("[mouseup] Отпустили мышь после клика, текущий режим карты: mode = " + self.mode);

                        // исключаем случайный dnd дрожащей рукой [xdnd?]
                        var dx = map.data('startX') - map.data('lastX');
                        var dy = map.data('startY') - map.data('lastY');
                        var delta = Math.sqrt(dx*dx + dy*dy);
                        var is_real_dragging = delta > 10;

                        // если это в самом деле был drag\n\drop
                        if (self.dragging && is_real_dragging) {

                            self.x = map.data('lastX');
                            self.y = map.data('lastY');
                        }

                        // иначе - пытаемся выяснить, в каком режиме находимся
                        else {

                            var p;
                            var $viewing_g_from_svg_overlay;

                            /* если находимся в режиме просмотра всей карты - входим в здание */
                            if (self.mode === 'viewing') {
                                //console.log($(event.target).parent()[0].obj.building);

                                // добираемся до объекта класса Здание, который обслуживает полигон
                                p = $(event.target).parent()[0];
                                if (p.obj && p.obj.building) {
                                    var building = p.obj.building;
                                    console.log("[mouseup] Текущий mode карты 'viewing' - Входим в здание (а потом building сам решит, входить ли на 1й этаж).");
                                    self.current_building = building; /* когда вошли в здание, определили переменную */
                                    building.enter();
                                }

                            }

                            /* если находимся в режиме рисования - рисуем */
                            else if (self.mode === 'creating') {

                                // и если ещё пока не начали рисовать (т.е. если это первый клик)
                                if (!self.is_draw) {

                                    var xx = self.rightX(event.pageX);
                                    var yy = self.rightY(event.pageY);
                                    //console.log("[mouseup] " + xx + "; " + yy);

                                    self.drawing_poligon = new Polygon(xx, yy, false, self);

                                    //self.addEvent(self.el[0], 'mousemove', self.drawing_poligon.onDraw)
                                    self.addEvent(self.el[0], 'mousemove', function (e) {
                                        var _n_f = self.drawing_poligon;
                                        var right_angle = !!e.shiftKey; //e.shiftKey ? true : false;

                                        _n_f.dynamicDraw(self.rightX(e.pageX), self.rightY(e.pageY), right_angle);
                                    })
                                        //.addEvent(self.drawing_poligon.helpers[0].helper, 'click', self.drawing_poligon.onDrawStop)
                                        //.addEvent(self.el[0], 'click', self.drawing_poligon.onDrawAddPoint);
                                        .addEvent(self.el[0], 'click', function (e) {

                                            // если кликнули в первую точку фигуры - заканчиваем рисование
                                            var $et = $(e.target);
                                            var $h = $(self.drawing_poligon.helpers[0].helper);
                                            if ($et.attr('x') === $h.attr('x') && $et.attr('y') === $h.attr('y')) {
                                                //self.drawing_poligon.onDrawStop();
                                                self.onDrawStop();
                                                return;
                                            }

                                            var x = self.rightX(e.pageX),
                                                y = self.rightY(e.pageY),
                                                _n_f = self.drawing_poligon;

                                            if (e.shiftKey) {
                                                var right_coords = _n_f.right_angle(x, y);
                                                x = right_coords.x;
                                                y = right_coords.y;
                                            }
                                            _n_f.addPoint(x, y);
                                        })
                                        .addEvent(document, 'keydown', self.onDrawStop);
                                }
                            }

                            /* если находимся в режиме просмотра здания - входим в площадь (так было в c80_map) */
                            /* если находится в режиме просмотра площади - переключаемся на другую площадь */
                            else if (self.mode === 'view_floor' || self.mode === 'view_area') { // self.mode == 'view_building' (так было в c80_map)

                                //console.log($(event.target).parent());
                                // => g, который живёт в #svg_overlay, или, другими словами,
                                // тот g, по которому кликнули последний раз,
                                // просматривая либо здание, либо площадь
                                $viewing_g_from_svg_overlay = $(event.target).parent();

                                // добираемся до объекта класса Area, который обслуживает полигон
                                p = $viewing_g_from_svg_overlay[0];
                                //console.log($(event.target).parent()[0].obj.area_hash);

                                if (p.obj && p.obj.area) {

                                    // запомним последний кликнутый полигон
                                    self.last_clicked_g = $viewing_g_from_svg_overlay;

                                    var area = p.obj.area;
                                    console.log("[mouseup] Входим в площадь. self.last_clicked_g = ");
                                    console.log(self.last_clicked_g);
                                    area.enter();
                                } else {
                                    console.log('[mouseup] [ERROR] у полигона нет объекта Area.js класса.');
                                }

                            }

                            else if (self.mode === 'removing') {
                                console.log('[main.js] mode = removing');

                                // => g, который живёт в #svg_overlay, или, другими словами,
                                // тот g, по которому кликнули последний раз,
                                // просматривая либо здание, либо площадь
                                $viewing_g_from_svg_overlay = $(event.target).parent();

                                // добираемся до объекта класса Area, который обслуживает полигон
                                p = $viewing_g_from_svg_overlay[0];

                                if (p.obj && p.obj.area) {
                                    console.log('[breakpoint]');
                                    var area = p.obj.area;
                                    self.registerDeletingArea(area);
                                } else {
                                    console.log('[main.js] [error] нету у полигона объекта, или этот объект не Area');
                                }

                            }

                        }

                        //noinspection JSUnresolvedFunction
                        self.map.off('mousemove');
                        //noinspection JSUnresolvedFunction
                        $(document).off('mouseup');

                        map.removeClass('mdragging');
                    });
                }
            }

            //noinspection JSUnresolvedFunction
            self.svg.on('mousedown', onDragNdrop);
            //noinspection JSUnresolvedFunction
            self.svg_overlay.on('mousedown', onDragNdrop);

            self.el[0].addEventListener('mousemove', function (e) {
                //coords_info.innerHTML = 'x: ' + rightX(e.pageX) + ', ' + 'y: ' + rightY(e.pageY);
            }, false);

            self.el[0].addEventListener('mouseleave', function () {
                //coords_info.innerHTML = '';
            }, false);

            /* Disable selection */
            //self.el[0].addEventListener('mousedown', function(e) { e.preventDefault(); }, false);

            /* Disable image dragging */
            self.el[0].addEventListener('dragstart', function (e) {
                e.preventDefault();
            }, false);

            self.back_to_map_button_klass = new BackToMapButton();
            self.back_to_map_button_klass.init("#ui", self);

            self.save_preloader_klass = new SavePreloader();
            self.save_preloader_klass.init();

        };

        // какой должен быть минимальный масштаб, чтобы вписать отрезок [min,max] в отрезок [p1,p2]
        self.calcScale = function (min, max, p1, p2) {
            //console.log("[calcScale] [" + min + "," + max + '] to [' + p1 + "," + p2 + "]");
            return (p2 - p1) / (max - min);
        };

        self.calcCoord = function (scale, pageC, logicC) {
            return pageC - scale * logicC;
        };

        var _$m = $("#map_wrapper");
        var _$b = $('.container');//$('footer .container');
        var $area_order_button = $('.area_order_button');
        var $container_buttons = $('#container_buttons');
        var _is_debug_drawn = false;
        var _$address_p = $('#paddress'); // 20161003: после редизайна надо дополнительно позиционировать блок с адресом

        // рассчитаем опорные переменные для view
        self.calcViewArea = function () {

            // прямоугольник, в который надо вписывать картинки зданий при входе в них
            self.X1 = self.o.left_padding;
            self.X2 = self.o.left_padding + self.o.focus_area_width;
            self.Y1 = self.o.top_padding;
            self.Y2 = self.o.top_padding + self.o.focus_area_height;
            self.CX = (self.X2 + self.X1) / 2;
            self.CY = (self.Y2 + self.Y1) / 2;

            // прямоугольник, в который надо вписывать полигоны площадей при входе в них
            self.X1S = _$b.offset().left + 200;
            self.Y1S = 140;
            self.X2S = self.X1 + _$b.width() * .4;
            self.X3 = self.X1 + _$b.width() - 100;
            self.Y2S = _$m.height() - 80;

            // "главный" прямоугольник (тот, в который вписывается картинка карты в режиме `view` )
            // (координаты прямоугольника даны в системе координат контейнера, содержащего карту)
            self.X10 = self.X1;
            self.X20 = _$m.outerWidth() - 15;
            self.Y10 = self.Y1;
            self.Y20 = _$m.outerHeight() - 15;
            self.CX0 = (self.X20 + self.X10) / 2;
            self.CY0 = (self.Y20 + self.Y10) / 2;

            // DEBUG DRAWING
            if (self.o.debug) {

                if (!_is_debug_drawn) {
                    _is_debug_drawn = true;

                    var style = "display:block;position:absolute;background-color:#00ff00;opacity:0.7;";
                    var style_x = style + "width:1px;height:800px;top:0;left:{X}px;";
                    var style_y = style + "width:3000px;height:1px;left:0;top:{Y}px;";
                    //var style_dot = style + 'width:4px;height:4px;left:{X}px;top:{Y}px;';

                    var to_draw = [
                        // {x: self.X1},
                        // {x: self.X2},
                        // {y: self.Y1},
                        // {y: self.Y2},
                        // {x: self.CX},
                        // {y: self.CY},

                        {x: self.X10},
                        {x: self.X20},
                        {y: self.Y10},
                        {y: self.Y20},
                        {x: self.CX0},
                        {y: self.CY0}
                    ];


                    var i, istyle, ip;
                    for (i = 0; i < to_draw.length; i++) {
                        ip = to_draw[i];

                        //noinspection EqualityComparisonWithCoercionJS
                        if (ip.x != undefined) {
                            istyle = style_x.split("{X}").join(ip.x);
                        } else { //noinspection EqualityComparisonWithCoercionJS
                            if (ip.y != undefined) {
                                istyle = style_y.split("{Y}").join(ip.y);
                            }
                        }

                        _$m.append($("<div style=" + istyle + "></div>"));
                    }

                }

            }

        };

        self.addEvent = function (target, eventType, func) {
            self.events.push(new AppEvent(target, eventType, func));
            return self;
        };

        self.removeAllEvents = function () {
            utils.foreach(self.events, function (x) {
                x.remove();
            });
            self.events.length = 0;
            self.edit_type = null;
            return this;
        };

        self.addNodeToSvg = function (node, is_overlay) {
            if (is_overlay) {
                self.svg_overlay[0].appendChild(node);
            } else {
                self.svg[0].appendChild(node);
            }
            return self;
        };

        self.removeNodeFromSvg = function(node, is_overlay) {
            if (is_overlay) {
                self.svg_overlay[0].removeChild(node);
            } else {
                self.svg[0].removeChild(node);
            }
            return this;
        };

        self.svgRemoveAllNodes = function () {
            self.svg.empty();
            self.svg_overlay.empty();
        };

        /** Нарисовать на карте объекты из массива childs.
         *
         * Массив childs содержит наборы однотипных объектов.
         * Т.е. объекты только одного типа приходят в фукнцию.
         * Типы могут быть: C80MapFloors::MapBuilding,C80MapFloors::Area
         *
         * Если мы рисуем набор Площадей C80MapFloors::Area, то:
         *          - это означает, что мы вошли в Здание C80MapFloors::Building.
         *          - parent_hash - это as_json объекта класса C80Rent:Building,
         *          который привязан к родителю отрисовываемого C80MapFloors::Area,
         *          (т.е. родитель - это C80MapFloors::Building).
         *           - И подаётся он для того, чтобы в окне с информацией о C80Rent:Area
         *           можно было отобразить характеристики Здания родителя C80Rent:Building.
         */
        self.draw_childs = function (childs, parent_hash) {
            //noinspection EqualityComparisonWithCoercionJS
            if (childs == undefined) return;
            console.log("[Map.draw_childs]");

            //var ip;
            var iobj;
            var ib, id, ia;
            for (var i = 0; i < childs.length; i++) {
                iobj = childs[i];

                switch (iobj["class_name"]) { /* NOTE:: сопоставление Ruby класса и JS класса */
                    case 'C80MapFloors::MapBuilding':
                        ib = new Building();
                        ib.init(iobj,self);
                        break;
                    case 'dot':
                        id = new Dot();
                        id.init(iobj,self);
                        break;
                    case 'C80MapFloors::Area':
                        ia = new Area();
                        ia.init(iobj, parent_hash, self);
                        break;
                    case 'C80MapFloors::Floor':
                        ia = new Floor();
                        ia.init(iobj, parent_hash, self);
                        break;
                }
                //ip = Polygon.createFromSaved(iobj);
                //utils.id('svg').appendChild(ip.g);
            }

            // Только после того, как нарисуем всех детей на карте, подсветим результаты поиска
            //noinspection EqualityComparisonWithCoercionJS
            if (self.search_gui_klass != null) {
                self.search_gui_klass.handleSearchResults();
            }

        };

        /**
         *  создаёт DOM элемент:
         *      <div class='mlayer #{obj_type}'>
         *          <img src='#{img_src}' class='mmap-image' />
         *      </div>
         *  и помещает его либо в map_overlay_layers, либо в map_layers (~ от параметра is_overlay)
         */
        self.draw_child_bg_image = function (img_src, obj_type, is_overlay) {
            var t;
            if (is_overlay === true) {
                t = self.map_overlay_layers;
            } else {
                t = self.map_layers;
            }
            // Create new map layer
            var layer = $('<div></div>').addClass('mlayer').addClass(obj_type).appendTo(t); // .hide()
            $('<img src="">').attr('src', img_src).addClass('mmap-image').appendTo(layer);

            return layer;
        };

        /**
         *  создаёт DOM элемент:
         *      <div class='map_object_image_bg'>        // style='background-image:url(#{img_src});'
         *          <img src=#{img_src} />
         *      </div>
         *  и помещает его в map_layers
         *
         *  left и top - координаты bound box верхнего левого угла здания
         *
         *  В новой версии используем предварительную загрузку картинки,
         *  и показ прелоадера во время загрузки. Когда картинка загрузится,
         *  она будет отображена на экране.
         */
        self.draw_map_object_image_bg = function (img_src, params) {

            // породим DOM
            var $div_map_object_image_bg = $('<div></div>')
                .addClass('mlayer')
                .appendTo(self.map_layers);

            // загрузим в него картинку
            return self._imageLoader.load(img_src, {
                $target:   $div_map_object_image_bg,
                 params:   params,
                on_load:   self._draw_map_object_image_bg_onload
            });

        };

        self._draw_map_object_image_bg_onload = function ($image) {
            setTimeout(function() {
                self.clear_all_map_object_image_bg();
            }, 500);
            self.__compose_css_style_for_map_object_image($image); // рассчитаем позиционирующий стиль и применим его к созданной оверлейной картинке
        };

        self.mark_all_map_object_images_for_clean = function () {
            $('.map_object_image_bg').addClass('for_clean');
        };

        self.clear_all_map_object_image_bg = function () {
            var $cc = $('.map_object_image_bg.for_clean');
            $cc.removeClass('shown');
            setTimeout(function () {
                $cc.parent().remove();
            },400);
        };

        /**
         * Задача этой служебной функции:
         *      - рассчёт актуальных (для данного масштаба) размеров и координат местонах указанного объекта (вместо объекта подаётся хэш описывающий его, с x,y,width,height)
         *      - составление css стиля для картинки с css-классом map_object_image_bg
         *      - присвоении этого стиля картинке
         *
         * Вызывается каждый шаг анимации и при входе в здание на первый этаж.
         *
         * Пользуется map.scale_during_animation при рассчётах
         *
         * @private
         */
        self.__compose_css_style_for_map_object_image = function ($img_with_class_map_object_image_bg) {

            var $i = $img_with_class_map_object_image_bg;

            // проведём калькуляцию [zoomove-calc]
            var left = $i.data("left")*self.scale_during_animation;
            var top = $i.data("top")*self.scale_during_animation;
            var width = $i.data("width")*self.scale_during_animation;
            var height = $i.data("height")*self.scale_during_animation;

            console.log('[__compose_css_style_for_map_object_image]');

            // впишем в DOM стили
            var style = 'top:';
            style += top + 'px;';
            style += "left:";
            style += left + 'px;';
            style += "width:";
            style += width + 'px;';
            style += "height:";
            style += height + 'px;';

            //console.log("> scale: " + self.scale + "; style: " + style);
            $i.attr('style',style);

        };

        //<editor-fold desc="// двигаем фигуру мышкой методом drag-n-drop">
        self.onMouseMove = function (e) { // мышь нажата и двигается

            //console.log("[Polygon.prototype.onMouseMove] _s_f = " + _s_f);
            //console.log("[Polygon.prototype.onMouseMove] e = ");
            //console.log(_s_f);
            //console.log(e.pageX);

            var selected_area = self.selected_area;
            var edit_type = self.edit_type;
            //console.log("[Polygon.prototype.onMouseMove] edit_type = " + edit_type);

            selected_area.dynamicEdit(selected_area[edit_type](e.pageX - selected_area.delta.x, e.pageY - selected_area.delta.y));
            selected_area.delta.x = e.pageX;
            selected_area.delta.y = e.pageY;
        };
        self.onMouseUp = function (e) { // отпустили мышь (другими словами - закончили drag'n'drop)
            console.log("[self.onMouseUp] [for_breakpoint] Отпустили мышь.");

            var _s_f = self.selected_area;
            var edit_type = self.edit_type;

            //#-> определим, был ли drag-n-drop вообще? Код работает неверно, поэтому и закомментирован

            var dx = e.pageX - _s_f.delta.x;
            var dy = e.pageY - _s_f.delta.y;

            //var delta = Math.sqrt(dx*dx + dy*dy);
            //var is_real_dragging = delta > 2;
            //
            // Если dnd был - двигаем фигуру
            //if (is_real_dragging) {
            //    console.log("[self.onMouseUp] Drag-n-drop detected.");
                var aa = _s_f[edit_type](dx, dy);
                var bb = _s_f.dynamicEdit(aa);
                _s_f.setParams(bb);
            //}
            //
            // если dnd не было - справляемся о режиме и в случае редактирования карты (т.е. когда допустимо назначать
            // Здания полигонам зданий) в current_building положим ссылку на фигуру, по которой был клик
            //else {

                // если это полигон здания - фиксируем его
                //var selected_area_building = self.selected_area.building;
                //if (selected_area_building != undefined && selected_area_building != null) {
                //    self.current_building = selected_area_building;
                //    console.log("[self.onMouseUp] Это не Drag-n-drop, а обычный клик по полигону Здания c id=" + self.current_building.options.id);
                //} else {
                //    console.log("[self.onMouseUp] Это не Drag-n-drop, а обычный клик по фигуре.");
                //}
                //console.log('[breakpoint]');
            //}

            self.removeAllEvents();
        };
        //</editor-fold>

        self.onDrawStop = function (e) {
            console.log("[Map.onDrawStop] Закончили рисовать.");

            //noinspection EqualityComparisonWithCoercionJS
            if (e != undefined) {
                if (e.type === 'keydown' && e.keyCode === 13) {
                    // its ok, continue execution..
                } else {
                    return
                }
            }

            var _n_f = self.drawing_poligon;
            if (_n_f.params.length >= 6) { //>= 3 points for polygon
                _n_f.polyline = _n_f.polygon;
                _n_f.polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                _n_f.g.replaceChild(_n_f.polygon, _n_f.polyline);
                _n_f.setCoords(_n_f.params).deselect();
                delete(_n_f.polyline);

                //#-> создадим либо полигон Здания, либо полигон Площади

                if (self.prev_mode === "edit_floor") {
                    console.log("[Map.onDrawStop] Создаём Area.");

                    //var bo = self.current_building.options;
                    var fo = self.current_building.json_current_floor(); // когда нарисовали полигон Площади - определяем Этаж родитель
                    var a = new Area();
                    a.init({ coords:_n_f.params }, fo, self);
                    //a.is_new = true;
                    _n_f.remove(); // удаляем нарисованный полигон, т.к. его уже заменили полигоном Area
                    self.registerJustDrownArea(a);
                }
                else if (self.prev_mode === 'editing') {
                    console.log("[Map.onDrawStop] Создаём Building.");
                    var b = new Building();
                    b.init({ coords:_n_f.params }, self);
                    //b.is_new = true;
                    _n_f.remove(); // удаляем нарисованный полигон, т.к. его уже заменили полигоном Building
                    self.registerJustDrownBuilding(b);
                }
                //else if (self.prev_mode == 'edit_building') {
                    // todo: new Floor (?)
                    //#-> нет, мы не можем нарисовать полигонЭтажа. Этаж - это картинка, которая просто видна при входе в Этаж, создаётся через админку
                //}

                self.removeAllEvents();
                self.drawing_poligon = null;
                self.is_draw = false;
            }

            self.setMode('editing');
        };

        self.registerJustDrownArea = function (area) {
            self.drawn_areas.push(area);
        };

        self.registerJustDrownBuilding = function (building) {
            self.drawn_buildings.push(building);
        };

        // отмечаем площадь, как "площадь для удаления",
        // т.е. помещаем её в список "для удаления",
        // который обработается, когда нажмём кнопку "сохранить изменения".
        self.registerDeletingArea = function(area) {
            var is_deleted = false;

            //noinspection EqualityComparisonWithCoercionJS
            if (utils.getById(area.id, self.areas_for_delete) == null) {
                console.log('[registerDeletingArea] Регистрируем: area.id = ' + area.id);
                self.areas_for_delete.push(area);
                is_deleted = true;
            } else {
                console.log('[registerDeletingArea] Убираем: area.id = ' + area.id);
                utils.deleteById(area.id, self.areas_for_delete);
            }

            area.invalidate_del_mark(is_deleted);
        };

        /**
         * Зная ширину контейнера и контента,
         * используя указанные параметры,
         * рассчитать нормальный X
         * @param params
         * @returns {*}
         */
        self.normalizeX = function (params) {
            // console.log("[normalizeX]");

            var x = params['x'];
            var scale = params['scale'];

            var minX = self.container.width() - self.contentWidth * scale;

            if (minX < 0) {
                if (x > 0) x = 0;
                else if (x < minX) x = minX;
            }
            else x = minX / 2;

            return x;
        };

        /**
         * Зная высоту контейнера и контента,
         * используя указанные параметры,
         * рассчитать нормальный Y
         * @param params
         * @returns {*}
         */
        self.normalizeY = function (params) {

            var y = params['y'];
            var scale = params['scale'];

            var minY = self.container.height() - self.contentHeight * scale;

            if (minY < 0) {
                if (y >= 0) y = 0;
                else if (y < minY) y = minY;
            }
            else y = minY / 2;

            return y;
        };

        /**
         * Используя ограничения по масштабу нормализовать scale
         * @param scale
         * @returns {*}
         */
        self.normalizeScale = function (scale) {
            console.log('[self.normalizeScale]' + self.o.fitscale);
            if (scale < self.o.fitscale) scale = self.o.fitscale;
            else if (scale > self.o.maxscale) scale = self.o.maxscale;

            if (self.zoombuttons) self.zoombuttons.update(scale);

            return scale;
        };

        /*self.zoomTo = function (x, y, s, duration, easing, ry) {
            duration = typeof duration !== 'undefined' ? duration : 400;
            ry = typeof ry !== 'undefined' ? ry : 0.5;

            // это значение нужно присвоить только после анимации
            self.scale = self.normalizeScale(self.o.fitscale * s);

            self.x = self.normalizeX(self.container.width() * 0.5 - self.scale * self.contentWidth * x);
            self.y = self.normalizeY(self.container.height() * ry - self.scale * self.contentHeight * y);

            console.log("[Map.zoomTo] Call moveTo.");
            self.moveTo(self.x, self.y, self.scale, duration, easing);
        };*/

        /**
         * задачи этой функции:
         *      - быть контейнером кода
         *      - считывать css атрибут self.map
         *      - по регулярке извлекать left и top
         *      - трансформировать эти значения
         *      - изменить атрибут viewBox обоих svg слоёв
         *
         *      Изначально была задумка каждый шаг анимации вызывать эту функцию.
         *      Но затем во время оптимизации слои с svg стали видны только тогда,
         *      когда анимация не проходит. По-этому этот код был поставлен на setTimeout
         *
         *      Отличие этого кода от [qq1] лишь в механике вычисления (извлечения) нужных значений.
         *      Скорее всего, это код-дубликат, который появился во время rush разработки.
         *      Т.е. желателен рефакторинг и упрощение логики, но не сейчас.
         * */
        var __afterMovingCorrectSvgLayersPositions = function () {
            //console.log(self.map.attr('style'));
            // left: -69.9985px; top: -299.999px;
            // left: [-]{0,1}(\d+\.\d+px);

            var str = self.map.attr('style');
            var rx_left = /left: [-]{0,1}(\d+\.\d+)px;/;
            var rx_top = /top: ([-]{0,1}\d+\.\d+)px;/;
            var match_left = str.match(rx_left);
            var match_right = str.match(rx_top);

            //noinspection EqualityComparisonWithCoercionJS
            if (match_left != null && match_right != null) {
                var x = -1 * Number(match_left[1]); // ["left: -69.9985px;", "69.9985"]
                var y = -1 * Number(match_right[1]); // ["left: -69.9985px;", "69.9985"]
                var att = x + " " + y + " " + self.contentWidth + " " + self.contentHeight;
                //console.log(x + "; y = " + y);
                self.svg.attr('viewBox', att);
                self.svg_overlay.attr('viewBox', att);
            }

        };

        /**
         * Вызывается после анимации moveTo
         * Задачей этого метода является :
         *  - сохранение x,y,scale в данных карты,
         *  - корректировка местонах и размера оверлейного слоя после анимации
         *
         * @param y                 // эти параметры есть конечная точка анимации moveTo,
         * @param x                 // т.е. к этим параметрам позиции стремится картинка карты и это анимируется
         * @param scale             // как только картинка карты дойдёт до цели - их надо сохранить в map
         *
         * @private
         */
        var __moveToComplete = function (x,y,scale) {
            //console.log("[__moveToComplete] x = " + x + "; y = " + y + "; scale = " + scale);

            /* NOTE:: CORE */

            if (scale !== undefined) self.scale = scale;
            self.x = x;
            self.y = y;

            if (self.tooltip) self.tooltip.position();

            __afterMovingCorrectSvgLayersPositions();

        };

        var __moveToTimeout = function () {
            if (self.mode === 'edit_area'|| self.mode === 'view_area') {
                $("#masked").removeClass('hiddn');
            }
        };
        /*var __moveToAnimate = function () {

        };*/

        /**
         * Рассчитывает scale_during_animation и корректирует местонах. оверлейных картинок.
         * Вызывается каждый шаг анимации moveto.
         * @private
         */
        var __moveToStep = function () {

            //var x = self.map.css('left').split('px').join('');
            //var y = self.map.css('top').split('px').join('');
            var w = self.map.css('width').split('px').join('');
            //var h = self.map.css('height').split('px').join('');

            //var image_width = MAP_WIDTH * scale;

            // рассчитаем мгновенное значение scale
            self.scale_during_animation = w / MAP_WIDTH;

            // [zoomove] пробежимся по всем оверлейным картинкам и позиционируем их
            $('.map_object_image_bg').each(function () {
                // рассчитаем и применим стиль
                self.__compose_css_style_for_map_object_image($( this ));
            });

            //console.log("[__moveToStep] x = " + x + "; y = " + y + "; w = " + w + "; h = " + h + "; scale = " + scale_during_animation);
        };

        // x,y - экранные координаты
        // сюда подаётся scale, который нужно присвоить map после анимации
        self.moveTo = function (x, y, scale, d, easing) {
            console.log("[self.moveTo] x = " + x + "; y = " + y + "; scale = " + scale + "; delay = " + d);
            //console.log('[self.moveTo]');

            // если подан аргумент scale(масштаб)
            // перемещаемся анимированно
            if (scale !== undefined) {

                // на время движения скрываем слой с полосатой анимацией
                //noinspection EqualityComparisonWithCoercionJS
                if (self.current_area != null) {
                    $("#masked").addClass('hiddn');
                    setTimeout(__moveToTimeout, d);
                }

                //setTimeout(__afterMovingCorrectSvgLayersPositions, d);

                self.map.stop().animate(
                    {
                        'left': x,
                        'top': y,
                        'width': self.contentWidth * scale,
                        'height': self.contentHeight * scale
                    },
                    {
                        'step': __moveToStep,
                        'complete': function () {
                            __moveToComplete(x,y,scale);
                        }
                    },
                    d,
                    easing          //,
                    //__moveToAnimate
                );

            }

            // если не подан аргумент scale(масштаб)
            // перемещаемся без анимации
            else {

                self.map.css({
                    'left': x,
                    'top': y
                });

                __moveToComplete(x,y);

                // отличие этого кода [qq1] от кода в [__afterMovingCorrectSvgLayersPositions] лишь в том,
                // что строка для атрибута viewbox формируется иным образом
                // Скорее всего, это код-дубликат, который появился во время rush разработки.
                //var t = (-x) + " " + (-y) + " " + self.contentWidth * self.scale + " " + self.contentHeight * self.scale;
                //self.svg.attr('viewBox',t);
                //self.svg_overlay.attr('viewBox', t);
            }

            //noinspection EqualityComparisonWithCoercionJS
            if (self.current_area != null) {
                self.current_area.invalidateAnimationMask();
            }

            //if (self.tooltip) self.tooltip.position();
            //if (self.minimap) self.minimap.update(x, y);
        };

        // показать инфо о просматриваемой площади
        self.showAreaInfo = function (area_json, parent_floor_json) {
            self.building_info_klass.show_area_info(area_json, parent_floor_json);
        };

        // перевод экранных координат в логические
        self.rightX = function(x) {
            return (x - self.x - self.container.offset().left) / self.scale;
        };

        self.rightY = function(y) {
            return (y - self.y - self.container.offset().top) / self.scale
        };

        // взять C80MapFloors::current_area и назначить ей Rent::area.id,
        // выбранный в окне _modal_window.html.erb
        self.link_area = function () {

            // фиксируем компоненты модального окна
            var $m = $('#modal_window');
            var $b = $m.find('.modal-footer').find('.btn');
            var $s = $m.find('select');

            // извлекаем значения
            var area_id = $s.val();
            var apolygon_id = self.current_area.id;
            console.log("[Map.link_area] Связать Площадь area_id = " + area_id + " c полигоном apolygon_id = " + apolygon_id);

            // нажимаем кнопку "закрыть"
            $b.click();

            // показываем прелоадер
            self.save_preloader_klass.show();

            // отправляем запрос на сервер
            // TODO_MY:: реализовать обработчик ошибок
            $.ajax({
                url:'/ajax/link_area',
                type:'POST',
                data: {
                    area_id: area_id,
                    apolygon_id: apolygon_id
                },
                dataType:"json"
            }).done(function (data, result) {
                self.save_preloader_klass.hide();
                self.data = data["updated_locations_json"];
            });

        };

        // взять C80MapFloors::current_floor и назначить ему sfloor_id выбранный в окне _modal_window.html.erb
        self.link_floor = function () {

            // фиксируем компоненты модального окна
            var $m = $('#modal_window');
            var $b = $m.find('.modal-footer').find('.btn');
            var $s = $m.find('select');

            // извлекаем значения
            var sfloor_id = $s.val(); // id Этажа
            var current_floor_id = self.current_building.json_current_floor()["id"]; // id Картинки Этажа (связываем Этаж с картинкой)
            console.log('[link_floor] Связать Этаж sfloor_id=' + sfloor_id + ' с Картинкой Этажа current_floor_id=' + current_floor_id + '.');

            // нажимаем кнопку "закрыть"
            $b.click();

            // показываем прелоадер
            self.save_preloader_klass.show();

            // отправляем запрос на сервер
            // TODO_MY:: реализовать обработчик ошибок
            $.ajax({
                url:'/ajax/link_floor',
                type:'POST',
                data: {
                    sfloor_id: sfloor_id,
                    floor_id: current_floor_id
                },
                dataType:"json"
            }).done(function (data, result) {
                self.save_preloader_klass.hide();
                self.data = data["updated_locations_json"];
            });

        };

        // взять C80MapFloors::current_building и назначить ему Rent::building.id,
        // выбранный в окне _modal_window.html.erb
        self.link_building = function () {
            //console.log('[Map.link_building] ');

            // фиксируем компоненты модального окна
            var $m = $('#modal_window');
            var $b = $m.find('.modal-footer').find('.btn');
            var $s = $m.find('select');

            // извлекаем значения
            var building_id = $s.val();
            var map_building_id = self.current_building["id"]; //#-> [iddqd]
            console.log("[Map.link_area] building_id = " + building_id + "; map_building_id = " + map_building_id);

            // нажимаем кнопку "закрыть"
            $b.click();

            // показываем прелоадер
            self.save_preloader_klass.show();

            // отправляем запрос на сервер
            // TODO_MY:: реализовать обработчик ошибок
            $.ajax({
                url:'/ajax/link_building',
                type:'POST',
                data: {
                    building_id: building_id,
                    map_building_id: map_building_id
                },
                dataType:"json"
            }).done(function (data, result) {
                self.save_preloader_klass.hide();
                self.data = data["updated_locations_json"];
            });

        };

        self.show_free_areas_hint = function () {
            // рисуем в слое #svg_overlay,
            // а т.к. находимся в режиме просмотра карты,
            // этот слой пуст, можно им пока воспользоваться



        };
        self.hide_free_areas_hint = function () {

        };

        // показать/скрыть все админские лейблы всех полигонов, которые отображены в данный момент на экране
        self.admin_label_show_all = function () {
            if (IS_ADMIN) {

                var s = self.svg;
                var c = s.children();
                var l = c.length;
                var i, ig;

                console.log('[admin_label_show_all] Показать все админские лейблы полигонов в кол-ве ' + l + ' шт.');

                for (i=0; i<l; i++) {
                    ig = s[0].children[i];          // именно [0]
                    //console.log(ig['obj']);       // => Polygon
                    //noinspection EqualityComparisonWithCoercionJS
                    if (ig != undefined) {          // такое тоже бывает
                        //noinspection EqualityComparisonWithCoercionJS
                        if (ig['obj'] != undefined) {   //
                            //noinspection EqualityComparisonWithCoercionJS
                            if (ig['obj']['building'] != undefined) {       // добираемся до класса Building.js
                                ig['obj']['building'].admin_label_show();   // показываем админский лейбл
                            }
                        }
                    }

                }

            }
        };
        self.admin_label_hide_all = function () {
            if (IS_ADMIN) {

                var s = self.svg;
                var c = s.children();
                var l = c.length;
                var i, ig;

                console.log('[admin_label_hide_all] Скрыть все админские лейблы полигонов в кол-ве ' + l + ' шт.');

                for (i=0; i<l; i++) {
                    ig = s[0].children[i];          // именно [0]
                    //console.log(ig['obj']);       // => Polygon
                    //noinspection EqualityComparisonWithCoercionJS
                    if (ig != undefined) {          // такое тоже бывает
                        //noinspection EqualityComparisonWithCoercionJS
                        if (ig['obj'] != undefined) {   //
                            //noinspection EqualityComparisonWithCoercionJS
                            if (ig['obj']['building'] != undefined) {       // добираемся до класса Building.js
                                ig['obj']['building'].admin_label_hide();   // скрываем админский лейбл
                            }
                        }
                    }

                }

            }
        };


    };

    //  Create a jQuery plugin
    $.fn.beMap = function (params) {
        var len = this.length;

        return this.each(function (index) {
            var me = $(this),
                key = 'beMap' + (len > 1 ? '-' + ++index : ''),
                instance = (new Map).init(me, params);
        });
    };

})
(jQuery);