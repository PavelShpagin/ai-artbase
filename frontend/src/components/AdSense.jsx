const AdSense = () => {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: `
        <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1723443730238637"
        crossorigin="anonymous"
      ></script>
        <ins
        class="adsbygoogle"
        style="display:block;width:320px;height:100px"
        data-ad-client="ca-pub-1723443730238637"
        data-ad-slot="1234567890"
        ></ins>
        <script>
        (adsbygoogle = window.adsbygoogle || []).push({});
      </script>`,
      }}
    />
  );
};

export default AdSense;
