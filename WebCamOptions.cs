namespace BlazorCam
{
    public class WebCamOptions
    {
        public int Width { get; set; } = 320;
        public string VideoID { get; set; }
        public string CanvasID { get; set; }
        public string Filter { get; set; } = null;
        public string BaseUrl { get; set; }
        public string MyPeerId { get; set; }
        public string TargetPeerId { get; set; }
        public string User { get; set; }
        public string Pass { get; set; }
        public bool Audio { get; set; }
    }
}