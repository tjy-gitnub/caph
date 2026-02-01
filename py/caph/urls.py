from django.urls import path
from . import views

urlpatterns = [
    path('', views.chatpage),
    path('isready',views.ready),
    path('guide',views.guidepage),
    path('tool/run_cmd', views.run_cmd),
    path('tool/open_url', views.open_url),

    # 文件工具路由
    path('tool/create_file', views.create_file),
    path('tool/create_folder', views.create_folder),
    path('tool/delete_file_or_folder', views.delete_file_or_folder),
    path('tool/move_file_or_folder', views.move_file_or_folder),
    path('tool/copy_file_or_folder', views.copy_file_or_folder),
    path('tool/rename_file_or_folder', views.rename_file_or_folder),
    path('tool/get_file_or_folder_props', views.get_file_or_folder_props),
    path('tool/open_file', views.open_file),
    path('tool/reveal_in_explorer', views.reveal_in_explorer),
    path('tool/read_file', views.read_file),
    path('tool/write_file', views.write_file),
    path('tool/list_directory', views.list_directory),
    path('tool/change_directory', views.change_directory),
]
