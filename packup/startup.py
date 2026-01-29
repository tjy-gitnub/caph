import os
from django.core.management import execute_from_command_line
def main():
    print('''
    Caph
    版本: %s

由星源开发 · Developed by Starry Source
Github tjy-gitnub/caph

服务端正在启动...'''.format(os.getenv('CAPH_VERSION','无')))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'caph_pj.settings')
    execute_from_command_line(["manage.py", "runserver","777","--noreload","--skip-checks"])
if __name__ == '__main__':
    main()