class RecoderCode < Formula
  desc "AI-powered coding assistant CLI"
  homepage "https://recoder.xyz"
  url "https://registry.npmjs.org/recoder-code-cli/-/recoder-code-cli-2.4.4.tgz"
  sha256 "PLACEHOLDER_SHA256"
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
