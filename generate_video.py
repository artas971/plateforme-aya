import os
import subprocess
import imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
workspace_dir = r"C:\Users\artas\Desktop\aya"
audio_file = os.path.join(workspace_dir, "audio_a_traiter", "WhatsApp Audio 2026-08-27 at 12.55.32.aac")
ass_file = os.path.join(workspace_dir, "subtitles.ass")
output_video = os.path.join(workspace_dir, "video_traduite.mp4")

# Premium subtitle styling with soft dark banner/pill for maximum legibility
ass_content = """[Script Info]
Title: Arabic to French Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: French,Arial,54,&H00FFFFFF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,0,0,1,3.5,2,2,40,40,95,1
Style: Arabic,Segoe UI,44,&H004DE6FF,&H000000FF,&H00000000,&HB0000000,-1,0,0,0,100,100,0,0,1,3.0,1.5,2,40,40,165,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:08.50,Arabic,,0,0,0,,{\\fade(250,250)}وين يبنا وين.. وين قطينهم؟
Dialogue: 0,0:00:00.00,0:00:08.50,French,,0,0,0,,{\\fade(250,250)}Où sont-ils partis ? Où est leur campement ?
Dialogue: 0,0:00:09.00,0:00:17.32,Arabic,,0,0,0,,{\\fade(250,250)}راحوا بغير بطائن.. يا محلى ذكرهم
Dialogue: 0,0:00:09.00,0:00:17.32,French,,0,0,0,,{\\fade(250,250)}Partis au loin... que leur souvenir est doux !
Dialogue: 0,0:00:18.00,0:00:22.02,Arabic,,0,0,0,,{\\fade(250,250)}أبكي للأحباب
Dialogue: 0,0:00:18.00,0:00:22.02,French,,0,0,0,,{\\fade(250,250)}Je pleure pour mes bien-aimés
Dialogue: 0,0:00:22.02,0:00:26.22,Arabic,,0,0,0,,{\\fade(250,250)}ندمي على القادم
Dialogue: 0,0:00:22.02,0:00:26.22,French,,0,0,0,,{\\fade(250,250)}Mon cœur se serre pour ceux qui s'en vont
Dialogue: 0,0:00:26.22,0:00:35.00,Arabic,,0,0,0,,{\\fade(250,250)}والله يا صحاب.. إيش يبقى من السهر؟
Dialogue: 0,0:00:26.22,0:00:35.00,French,,0,0,0,,{\\fade(250,250)}Par Dieu, mes amis, que nous reste-t-il de nos veillées ?
"""

with open(ass_file, "w", encoding="utf-8") as f:
    f.write(ass_content)

cmd = [
    ffmpeg_exe,
    "-y",
    "-loop", "1",
    "-i", "background.jpg",
    "-i", audio_file,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,ass=subtitles.ass",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-t", "40.46",
    output_video
]

res = subprocess.run(cmd, cwd=workspace_dir, capture_output=True, text=True, encoding="utf-8", errors="replace")
print("Return code:", res.returncode)
if res.returncode == 0:
    print("Video regenerated successfully!")
