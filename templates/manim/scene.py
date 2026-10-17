from manim import (
    Arrow, Create, DOWN, FadeIn, GREEN_C, LEFT, RIGHT, Scene, Square,
    Text, Transform, UP,
)


class Projection(Scene):
    def construct(self):
        self.camera.background_color = "#0c1220"
        title = Text("A vector, transformed", font_size=42).to_edge(UP, buff=0.8)
        source = Square(side_length=1.5, color=GREEN_C).shift(LEFT * 3)
        source_label = Text("input", font_size=24).next_to(source, DOWN)
        target = Square(side_length=1.5, color="#9dacf8").shift(RIGHT * 3)
        target_label = Text("projection", font_size=24).next_to(target, DOWN)
        arrow = Arrow(source.get_right(), target.get_left(), buff=0.3)
        caption = Text("A learned map changes the representation.", font_size=25).to_edge(DOWN, buff=0.8)

        self.play(FadeIn(title), FadeIn(source_label), Create(source), run_time=1)
        self.play(Create(arrow), FadeIn(caption), run_time=1)
        self.play(Transform(source.copy(), target), FadeIn(target_label), run_time=1.5)
        self.wait(2.5)
