from helper import Formatter, build_path


def run():
    fmt = Formatter()
    return fmt.format(build_path("data"))


if __name__ == "__main__":
    print(run())
