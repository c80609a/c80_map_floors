"use strict";

function Building() {

    var _map = null;
    var _this = this;
    var _options = null;
    var _polygon = null;

    // хэш с этажами здания
    var _map_floors_hash = {};

    // экранные координаты левой верхней точки, куда надо вписать полигон здания
    //var _left_page_x = 342;
    //var _left_page_y = 65;

    // bounding box полигона (в логических координатах)
    var _bbox = null;

    // центр полигона (в логических координатах)
    var _cx = null;
    var _cy = null;

    var _$image_bg = null;
    var _image_overlay = null;

    // если вошли в какой-то этаж - эта переменная будет хранить ссылку на объект с данными полигона Этажа из locations.json
    var _json_current_floor = null;

    _this.id = null;
    _this._label = null; // подпись над зданием - сколько магазинов (удовлетворяющих поиску) находятся в Здании
    _this._admin_label = null; // админский лейбл - айдишник и название Здания (привязанного к полигону), видимый в режиме редактирования

    var _zoomToMe = function () {
        console.log('<_zoomToMe>');

        /* рассчитаем масштаб, при котором можно вписать прямоугольник дома в прямоугольник рабочей области */

        var scaleX = _map.calcScale(_bbox.xmin, _bbox.xmax, _map.X1, _map.X2);
        var scaleY = _map.calcScale(_bbox.ymin, _bbox.ymax, _map.Y1, _map.Y2);
        //console.log("<Building.enter> scaleX = " + scaleX + ", scaleY = " + scaleY);

        var scale = (scaleX < scaleY) ? scaleX : scaleY;
        scale = _map.normalizeScale(scale);

        var x = _map.normalizeX({
            x: _map.CX - scale * _cx, // + _map.container.offset().left,
            scale: scale
        });

        var y = _map.normalizeY({
            y: _map.CY - scale * _cy, // - _map.container.offset().top,
            scale: scale
        });

        //console.log("<Building.enter> [qq] moveTo: " + _map.x + ", " + _map.y);
        _map.moveTo(x, y, scale, 400, 'easeInOutCubic');
    };

    // map_floor_as_json - это as_json модели C80MapFloors::Floor
    /*{
        "map_building_id": 7,
        "img_bg": {
            "url": "/uploads/map/floors/floor_e7dc.gif",
            "thumb": {"url": "/uploads/map/floors/thumb_floor_e7dc.gif"}
        },
        "img_overlay": {
            "url": null,
            "thumb": {"url": null}
        },
        "id": 2,
        "title": "Первый этаж",
        "tag": "first_test_floor",
        "ord": 1,
        "coords": "",
        "class_name": "C80MapFloors::Floor",
        "areas": [
        {
            "floor_id": 2,
            "id": 2,
            "tag": "test_area",
            "coords": "10,12,110,112",
            "area_representator_id": null,
            "class_name": "C80MapFloors::Area"
        },
        "data": {
            "id": 1,
            "title": "test building",
            "square": null,
            "square_free": null,
            "desc": null,
            "floor_height": "2.3м - 4.2м",
            "price_string": "От 300 руб/м.кв.",
            "communications": "Интернет, Вода, Свет"
        }
    ]
    }*/
    var _draw_floor = function (map_floor_as_json) {
        //console.log('<Building._draw_floor>');

        // это тот самый код, который остался без изменений с версии c80_map (прошлой версии)
        if (map_floor_as_json["img_overlay"]["url"] != "null") {
            //_image_overlay = _map.draw_child_bg_image(map_floor_as_json["img_overlay"]["url"], 'building', true);
        }
        if (map_floor_as_json["img_bg"]["url"] != "null") {

            // картинку этажа рисуем по значениям из базы
            var xx2 = 0;
            var yy2 = 0;
            if (map_floor_as_json["coords"].length) {
                var tmp2 = map_floor_as_json["coords"].split(',');
                xx2 = parseInt(tmp2[0]);
                yy2 = parseInt(tmp2[1]);
            }

            // пока не загрузили картинку этажа - не будем удалять отображённые картинки этажей, отметим их "для удаления"
            _map.mark_all_map_object_images_for_clean();

            // просим карту нарисовать картинку с данными характеристиками
            _$image_bg = _map.draw_map_object_image_bg(map_floor_as_json["img_bg"]["url"], {
                x: xx2,
                y: yy2,
                width: map_floor_as_json["img_bg_width"],
                height: map_floor_as_json["img_bg_height"]
            }/*, 'building'*/);

        } else {
            alert('[ERROR] У этажа нет картинки.');
        }

        // просим карту нарисовать полигоны площадей
        _map.draw_childs(map_floor_as_json["areas"], map_floor_as_json);

    };

    // options_floors - as_json массива этажей модели C80MapFloors::Floor
    var _parse_floors = function (options_floors) {

        // соберём в удобный хэш
        var i, ifloor_json, ifloor_id;
        for (i = 0; i < options_floors.length; i++) {
            ifloor_json = options_floors[i];
            ifloor_id = ifloor_json["id"];
            _map_floors_hash[ ifloor_id ] = ifloor_json;
        }

    };

    var _process_floors_data = function () {

        if (_options["floors"] != undefined && _options["floors"].length) {
            _parse_floors(_options["floors"]);
        } else {
            alert('У здания нет этажей, а должны быть.');
        }

    };

    /**
     *
     * @param options - Это C80MapFloors::MapBuilding.my_as_json5
     * @param link_to_map
     */
    _this.init = function (options, link_to_map) {

        if (options['coords'] != undefined && options['coords'].length) {
            console.log("<Building.init>");

            _map = link_to_map;
            _options = options;
            _this.options = options;
            if (typeof _this.options["coords"] == 'string') { /* когда нажимаем ENTER в редакторе и завершаем рисование полигона - приходит массив */
                _this.options["coords"] = _this.options["coords"].split(',');
            }

            //#-> [iddqd] ВАЖНО: это id  полигона здания
            _this.id = options["id"];

            // [NOTE::56dfaw1: парсим координаты объекта на карте, поданные в виде строки]
            for (var i=0; i<_this.options.coords.length; i++) {
                _this.options.coords[i] = Number(_this.options.coords[i]);
            }

            // [4ddl5df]: в случае, если это только что отрисованное Здание - генерим временный случайный id
            //#-> [iddqd] А как же тогда _this.id ? Он будет undefined? Страшно ли это?
            if (_this.options["id"] == undefined) {
                _this.options["id"] = Math.ceil((Math.random()*100000));
            }

            // создать полигон здания и прицепить в список отображения карты [в svg слой (т.к. is_overlay = false)]
            _polygon = Polygon.createFromSaved(options, false, _map);
            _polygon.building = _this;


            //<editor-fold desc="// если у полигона здания имеется Здание - добавим css класс (для разукрашивания таких полигонов в режиме редактирования)">
            var k = '';

            if (_options != null) {
                if (_options["data"] != null) {
                    k = 'linked';
                }
            }

            $(_polygon.polygon).addClass(k);
            //</editor-fold>

            _this._calcBBox();

            // подпись над полигоном показываем только админам
            // UPD: не прокатит, т.к. здания инициализируются ДО того, как приходит ajax/map_edit_buttons, где IS_ADMIN=true
            //if (IS_ADMIN) {
            //    _this._admin_label = new AdminBuildingLabel(options, _map);
            //}

        }
    };

    _this.enter = function () {
        //console.log("<Building.enter>");
        //console.log(_options);

        // отдадим информацию о C80MapFloors::MapBuilding в панель
        _map.building_info_klass.setData(_options);

        _zoomToMe();

        setTimeout(function () {

            // запустим внутренний механизм парсинга этажей и их отрисовки
            _process_floors_data();

            // если у ПолигонаЗдания есть ПолигоныЭтажей - войдем в 1й этаж
            if (fCalcObjSize(_map_floors_hash) > 0) {
                console.log("<Building.enter> У ПолигонаЗдания есть ПолигоныЭтажей  - войдём на 1й этаж.");

                // клик по первой tab-кнопке заставит войти на 1й этаж
                _map.building_info_klass.setSelectedFloor(0);

                // попросим изменить состояние окружающей среды
                _map.setMode('view_floor');

            }
            // если у здания нет этажей - перейдём в режим просмотра здания
            else {
                console.log("<Building.enter> У ПолигонаЗдания НЕТ ПолигоновЭтажей - просто войдём в Здание.");

                // NOTE:: но кнопки этажей могут при этом быть отрисованы - т.к. кнопки строятся по ПолигонамЭтажей.

                // попросим изменить состояние окружающей среды
                _map.setMode('view_building');
            }


        }, 400);

        // при входе в здание удаляем все кликабельные полигоны зданий
        _map.svgRemoveAllNodes();

        //console.log("<Building.enter> id: " + _this.id);
        _map.mark_virgin = false;

    };

    /**
     * Войти на этаж здания - т.е. НАРИСОВАТЬ картинку этажа.
     * @param floor_id
     */
    _this.enterFloor = function (floor_id) {

        // при входе в этаж - удаляем все кликабельные полигоны с карты
        _map.svgRemoveAllNodes();

        var flr = _map_floors_hash[floor_id];
        if (flr != undefined) {
            // рисуем картинку этажа (там же будет заказ на отрисовку полигонов площадей)
            _draw_floor(flr);
            // фиксируем текущий этаж
            _json_current_floor = flr;
            console.log('<Building.enterFloor> Вошли на этаж floor_id: ' + floor_id + "; данные полигона этажа: ");
            console.log(_json_current_floor);
        } else {
            alert('[Building.EnterFloor] error: Нет данных об этаже [карты] floor_id='+floor_id+'.');
        }


    };
    _this.exit = function () {

        if (_$image_bg != null) _$image_bg.remove();
        if (_image_overlay != null) {
            _image_overlay.remove();
        }
        _$image_bg = null;
        _image_overlay = null;
        //_zoomToMe();

        // чистим переменную "текущий этаж"
        _json_current_floor = null;

    };

    // выдать данные текущего полигона этажа
    _this.json_current_floor = function () {
        return _json_current_floor;
    };

    // выдать центр дома в логических координатах
    _this.cx = function () {
        return _cx;
    };
    _this.cy = function () {
        return _cy;
    };

    // рассчитаем bounding box полигона (в логических координатах)
    _this._calcBBox = function () {

        var coords = _options.coords;
        var xmin = Number.MAX_VALUE;
        var ymin = Number.MAX_VALUE;
        var xmax = Number.MIN_VALUE;
        var ymax = Number.MIN_VALUE;

        var ix, iy;
        for (var i = 0, c = coords.length; i < c; i += 2) {
            ix = coords[i];
            iy = coords[i + 1];

            //console.log(xmin + " VS " + ix);
            xmin = (ix < xmin) ? ix : xmin;
            ymin = (iy < ymin) ? iy : ymin;

            xmax = (ix > xmax) ? ix : xmax;
            ymax = (iy > ymax) ? iy : ymax;
        }


        _bbox = {
            xmin: xmin,
            ymin: ymin,
            xmax: xmax,
            ymax: ymax
        };

        _cx = xmin + (xmax - xmin) / 2;
        _cy = ymin + (ymax - ymin) / 2;

        //console.log("<Building._calcBBox> " +
            //xmin + "," + ymin + "; " + xmax + "," + ymax +
        //"; center logical: " + _cx + "," + _cy + ", center screen: " + _map.rightX(_cx) + ", " + _map.rightY(_cy));

        //console.log('<Building._calcBBox> ' + xmin + ', ' + ymin);
    };

    // при редактировании здания (т.е. изменении полигонов и holer-ов площадей)
    // необходимо, чтобы оверлейный слой с колоннами не мешал кликам мышки
    // добраться до слоя с svg
    // эти методы для этого имплементированы
    _this.changeOverlayZindex = function () {
        if (_image_overlay != null) {
            _image_overlay.css('z-index', '1');
        }
    };
    _this.resetOverlayZindex = function () {
        if (_image_overlay != null) {
            _image_overlay.css('z-index', '3');
        }
    };

    _this.to_json = function () {
        return {
            id:     _this.options["id"], //#-> [iddqd] А здесь не используется _this.id (т.е. в случае, когда полигон был только что нарисован, to_json вернёт актуальное, правильное значение
            coords: _this.options["coords"]
        }
    };

    // выдать id привязанного к полигону Здания
    this.get_bid = function () {
      var result = null;
      if (_options != null) {
          if (_options["data"] != null && _options["data"] != undefined) {
              result = _options["data"]["id"];
          }
      }
      return result;
    };

    // показать/скрыть админские лейблы
    this.admin_label_show = function () {
        if (_this._admin_label == null) {
            console.log('<Building.admin_label_show> Показать админский лейбл полигона Здания id=' + _this.id);
            _this._admin_label = new AdminBuildingLabel(_options, _map, {cx:_cx, cy:_cy});
        }
    };
    this.admin_label_hide = function () {
        if (_this._admin_label != null) {
            console.log('<Building.admin_label_hide> Уничтожить админский лейбл.');
            _this._admin_label.destroy();
            _this._admin_label = null;
        }
    };

    // показать/скрыть зеленые кружки с цифрами
    this.greenCircleShow = function (count) { // count - кол-во (удовлетворяющих поиску) магазинов в здании
        console.log('<Building.greenCircleShow> Покажем зеленую метку над зданием.');
        if (_this._label == null) {
            _this._label = new BuildingLabel({
                x: _options['coords'][0],
                y: _options['coords'][1],
                count: count
            }, _map);
        }
    };
    this.greenCircleHide = function () {
        console.log('<Building.greenCircleShow> Скроем зеленую метку над зданием.');
        if (_this._label != null) {
            _this._label.destroy();
            _this._label = null;
        }
    };
}
