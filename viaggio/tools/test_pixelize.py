import unittest
from PIL import Image
import pixelize as px

class T(unittest.TestCase):
    def test_soglia_alpha(self):
        im = Image.new("RGBA", (2, 1)); im.putpixel((0, 0), (255, 0, 0, 100)); im.putpixel((1, 0), (0, 255, 0, 200))
        out = px.soglia_alpha(im)
        self.assertEqual(out.getpixel((0, 0))[3], 0); self.assertEqual(out.getpixel((1, 0))[3], 255)

    def test_pixellizza_altezza_e_crop(self):
        im = Image.new("RGBA", (400, 400)); im.paste((255, 0, 0, 255), (100, 0, 300, 400))
        out = px.pixellizza(im, 48)
        self.assertEqual(out.height, 48); self.assertEqual(out.width, 24)

    def test_pixellizza_media_non_campione(self):
        # scacchiera fine rosso/blu: con BOX ogni pixel finale è la media (viola), non un campione a caso
        im = Image.new("RGBA", (64, 64))
        for y in range(64):
            for x in range(64):
                im.putpixel((x, y), (255, 0, 0, 255) if (x + y) % 2 else (0, 0, 255, 255))
        out = px.pixellizza(im, 8)
        r, g, b, a = out.getpixel((3, 3))
        self.assertTrue(100 < r < 160 and 100 < b < 160, (r, g, b))

    def test_scala_comune_fotogrammi(self):
        alto = Image.new("RGBA", (100, 200)); alto.paste((255, 0, 0, 255), (0, 0, 100, 200))
        basso = Image.new("RGBA", (100, 200)); basso.paste((255, 0, 0, 255), (0, 50, 100, 200))
        f = px.scala_comune([alto, basso], 40)
        self.assertEqual(px.pixellizza(alto, scala=f).height, 40)
        self.assertEqual(px.pixellizza(basso, scala=f).height, 30)   # non riscalato a 40

    def test_palette_comune(self):
        a = Image.new("RGBA", (4, 4), (250, 10, 10, 255)); b = Image.new("RGBA", (4, 4), (10, 10, 250, 255))
        pal = px.estrai_palette([a, b], 2)
        self.assertEqual(len(pal), 2)
        out = px.applica_palette(Image.new("RGBA", (1, 1), (240, 20, 20, 255)), pal)
        self.assertIn(out.getpixel((0, 0))[:3], pal)

    def test_contorno(self):
        im = Image.new("RGBA", (3, 3), (0, 0, 0, 0)); im.putpixel((1, 1), (255, 255, 255, 255))
        out = px.contorno(im)
        self.assertEqual(out.getpixel((0, 1)), (24, 16, 24, 255)); self.assertEqual(out.getpixel((0, 0))[3], 0)

    def test_ripetibile_giunzione(self):
        im = Image.new("RGB", (100, 1))
        for x in range(100): im.putpixel((x, 0), (x * 2, 255 - x * 2, 0))   # gradiente
        out = px.ripetibile(im, banda=20)
        self.assertEqual(out.size, (80, 1))
        self.assertEqual(out.getpixel((0, 0)), im.getpixel((80, 0)))      # riparte da dove finirebbe
        self.assertEqual(out.getpixel((79, 0)), im.getpixel((79, 0)))
        self.assertEqual(out.getpixel((50, 0)), im.getpixel((50, 0)))

    def test_sheet(self):
        f = lambda w, h: Image.new("RGBA", (w, h), (255, 0, 0, 255))
        sheet, meta = px.monta_sheet({"cammina": [f(20, 40), f(22, 40)], "salto": [f(24, 44)]})
        self.assertEqual((meta["fw"], meta["fh"]), (24, 44))
        self.assertEqual(meta["righe"], {"cammina": [0, 2], "salto": [1, 1]})
        self.assertEqual(sheet.size, (48, 88))

if __name__ == "__main__":
    unittest.main()
