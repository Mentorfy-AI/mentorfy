"use client"

import { useState } from "react"
import { Upload, Video, MessageSquare, Palette, Zap, Plus, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export default function ExperiencePage() {
  const [onboardingQuestions, setOnboardingQuestions] = useState([
    "What are your main learning goals?",
    "What challenges are you currently facing?",
    "How do you prefer to receive feedback?",
  ])
  const [transformation, setTransformation] = useState("")
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [bio, setBio] = useState("")
  const [selectedColor, setSelectedColor] = useState("#3b82f6")

  const brandColors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#6366f1",
    "#14b8a6",
    "#eab308",
  ]

  const integrationPlatforms = [
    { name: "Discord", icon: "🎮", connected: false },
    { name: "Slack", icon: "💬", connected: false },
    { name: "Telegram", icon: "✈️", connected: false },
    { name: "WhatsApp", icon: "📱", connected: false },
    { name: "Zapier", icon: "⚡", connected: false },
    { name: "API", icon: "🔗", connected: false },
  ]

  const addQuestion = () => {
    setOnboardingQuestions([...onboardingQuestions, ""])
  }

  const updateQuestion = (index: number, value: string) => {
    const updated = [...onboardingQuestions]
    updated[index] = value
    setOnboardingQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setOnboardingQuestions(onboardingQuestions.filter((_, i) => i !== index))
  }

  const handleFileUpload = (type: "profile" | "banner" | "video") => {
    // Simulate file upload
    const input = document.createElement("input")
    input.type = "file"
    input.accept = type === "video" ? "video/*" : "image/*"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        if (type === "profile") setProfilePicture(url)
        if (type === "banner") setBanner(url)
      }
    }
    input.click()
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance">Experience - Student Interface</h1>
          <p className="text-muted-foreground text-pretty">
            Customize your AI mentor experience and student onboarding
          </p>
        </div>

        <Tabs defaultValue="onboarding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="onboarding" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="brand" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Brand
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="onboarding" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Onboarding Video
                  </CardTitle>
                  <CardDescription>Upload a welcome video that students see when they first log in</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">No video uploaded yet</p>
                    <Button onClick={() => handleFileUpload("video")}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Video
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transformation Goal</CardTitle>
                  <CardDescription>Define what transformation your students will achieve</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="e.g., Transform from beginner to confident public speaker in 30 days"
                    value={transformation}
                    onChange={(e) => setTransformation(e.target.value)}
                    className="min-h-[100px]"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Onboarding Questions</CardTitle>
                <CardDescription>
                  Customize the questions students answer to personalize their experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {onboardingQuestions.map((question, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={question}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      placeholder="Enter your question..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeQuestion(index)}
                      disabled={onboardingQuestions.length <= 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={addQuestion} variant="outline" className="w-full bg-transparent">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Picture</CardTitle>
                  <CardDescription>Upload your AI mentor's profile picture</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {profilePicture ? (
                        <img
                          src={profilePicture || "/placeholder.svg"}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <Button onClick={() => handleFileUpload("profile")}>
                      {profilePicture ? "Change Picture" : "Upload Picture"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Banner Image</CardTitle>
                  <CardDescription>Upload a banner for your chat interface</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="w-full h-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {banner ? (
                        <img src={banner || "/placeholder.svg"} alt="Banner" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <Button onClick={() => handleFileUpload("banner")} className="w-full">
                      {banner ? "Change Banner" : "Upload Banner"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>AI Bio</CardTitle>
                  <CardDescription>Write a bio for your AI mentor</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="I'm your AI mentor, here to guide you through your transformation journey..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="min-h-[120px]"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Brand Colors</CardTitle>
                  <CardDescription>Choose your primary brand color</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 gap-3">
                    {brandColors.map((color) => (
                      <button
                        key={color}
                        className={`w-10 h-10 rounded-lg border-2 ${
                          selectedColor === color ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedColor(color)}
                      />
                    ))}
                  </div>
                  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: selectedColor + "10" }}>
                    <p className="text-sm font-medium" style={{ color: selectedColor }}>
                      Preview: This is how your brand color will look
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Integrations</CardTitle>
                <CardDescription>Connect your AI mentor to various platforms where your students are</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {integrationPlatforms.map((platform) => (
                    <Card key={platform.name} className="relative">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{platform.icon}</span>
                            <div>
                              <h3 className="font-semibold">{platform.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {platform.connected ? "Connected" : "Not connected"}
                              </p>
                            </div>
                          </div>
                          <Badge variant={platform.connected ? "default" : "secondary"}>
                            {platform.connected ? "Connected" : "Connect"}
                          </Badge>
                        </div>
                        <Button className="w-full mt-4" variant={platform.connected ? "outline" : "default"}>
                          {platform.connected ? "Configure" : "Connect"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
