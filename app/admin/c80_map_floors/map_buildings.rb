ActiveAdmin.register C80MapFloors::MapBuilding, as: 'MapBuilding' do

  menu :label => 'Полигоны зданий', :parent => 'Карта'#, :if => proc { current_admin_user.email == 'tz007@mail.ru' }

  before_filter :skip_sidebar!, :only => :index

  permit_params :img, 
                :coords, 
                :coords_img,
                :tag,
                :title

  config.sort_order = 'id_asc'

  index do
    column :id
    column :tag
    column :title
    column :building_representator
    column :coords do |mp|
      d = mp.coords
      "<div style='width:100px;overflow:hidden;'>#{d}</div>".html_safe
    end
    column :coords_img do |mp|
      d = mp.coords_img
      "<div style='width:70px;overflow:hidden;'>#{d}</div>".html_safe
    end
    column :created_at
    column :updated_at
    # column 'img' do |sp|
    #   "#{ link_to image_tag(sp.img.thumb.url, :style => 'background-color: #cfcfcf;'), sp.img.url, :target => '_blank' }<br>
    #   ".html_safe
    # end
    actions
  end

  form(:html => {:multipart => true}) do |f|

    f.inputs 'Свойства' do
      f.input :tag
      f.input :title
      f.input :coords, :input_html => {:style => 'height:50px'}
      f.input :coords_img, :input_html => {:style => 'height:50px'}
      # f.input :img, :hint => "#{image_tag(f.object.img.thumb.url) if f.object.img.present?}".html_safe
    end

    f.actions
  end

end