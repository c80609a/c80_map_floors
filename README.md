# C80MapFloors

The gem adds interactive map (with floors) to a site.

## Installation

Add this line to your host app's Gemfile:

```ruby
    gem 'historyjs-rails'
    gem 'bootstrap-sass', '~> 3.3.4'
    gem 'bootstrap-select-rails'
    gem 'c80_map_floors'
```

Host app's `application.js.coffee` requires:

```
    #= require c80_map_floors
```

Add this to `application.scss`:

```
    @import "c80_map_floors";
```

Add this to host app's `application_controller.rb`:

```
    helper C80MapFloors::Engine.helpers
```

Add this to `routes.rb`:

```
    mount C80MapFloors::Engine => '/'
```

# Configure

Use seeds:

```
    $ rake db:seed:801_fill_map_settings
```


## Start

Create in host app's assets\javascripts:

```js
$(document).ready(function() {
    if ($('#map_wrapper').length) {
        InitMap({
            dnd_enable:false
        });
    }
});
```


# Helpers
```
    render_map
```
