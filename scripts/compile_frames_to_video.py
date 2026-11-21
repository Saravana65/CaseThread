import os
import cv2
import glob

FRAMES_DIR = os.path.join(os.path.dirname(__file__), '..', 'walkthrough_frames')
OUTPUT_VIDEO = os.path.join(os.path.dirname(__file__), '..', 'CASETHREAD_Demonstration_Walkthrough.mp4')
FPS = 18

def compile_video():
    frame_files = sorted(glob.glob(os.path.join(FRAMES_DIR, 'frame_*.jpg')))
    total = len(frame_files)
    print(f"=== Compiling {total} Frames into {OUTPUT_VIDEO} ===")

    if total == 0:
        print("[ERROR] No frames found to compile!")
        return

    # Read first frame to get dimensions
    first = cv2.imread(frame_files[0])
    h, w, c = first.shape
    print(f"Resolution: {w}x{h} @ {FPS} fps")

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(OUTPUT_VIDEO, fourcc, float(FPS), (w, h))

    for idx, fpath in enumerate(frame_files):
        img = cv2.imread(fpath)
        if img is not None:
            out.write(img)
        if idx % 100 == 0:
            print(f"Processed frame {idx}/{total}...")

    out.release()
    print(f"\n[SUCCESS] Final Video Written: {OUTPUT_VIDEO}")
    print(f"File Size: {os.path.getsize(OUTPUT_VIDEO) / (1024*1024):.2f} MB")

if __name__ == '__main__':
    compile_video()
