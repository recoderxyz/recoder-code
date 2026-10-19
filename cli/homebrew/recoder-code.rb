class RecoderCode < Formula
  desc "AI-powered coding assistant CLI"
  homepage "https://recoder.xyz"
  url "https://registry.npmjs.org/recoder-code/-/recoder-code-2.5.5.tgz"
  sha256 "2ac3dbd998c475820762c4a19c1d6135b4b11b293c62490636ccf8d44b6b6d98"
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "recoder-code", shell_output("#{bin}/recoder-code --version")
  end
end
