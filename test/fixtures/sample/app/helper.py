import os


def build_path(name):
    return os.path.join("/tmp", name)


class Formatter:
    def format(self, value):
        return f"[{value}]"
